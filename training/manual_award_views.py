"""
Manual competency awards (verbal assessment, admin-approved).

Flow:
  1. Manager submits a ManualCompetencyAward (POST /api/training/manual-awards/)
     with employee, competency, score, optional level, optional notes.
  2. The award sits PENDING; an admin sees it in their queue
     (GET /api/training/manual-awards/pending/).
  3. Admin approves or rejects via /approve/ or /reject/.
  4. On approval we create the matching EmployeeCompetencyRecord, and if
     the manager specified a level, write it to User.manual_level_override.
  5. The manager is notified of the outcome. On approval the employee
     gets a notification as well.

This module is self-contained (serializer + views in one place) so it
does not need to import from training/serializers.py, which has been
historically fragile on the build mount.
"""
from rest_framework import serializers, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone

from accounts.models import User, Notification
from training.models import (
    ManualCompetencyAward,
    Competency,
    EmployeeCompetencyRecord,
)


# ---------------------------------------------------------
# Serializer
# ---------------------------------------------------------

class ManualCompetencyAwardSerializer(serializers.ModelSerializer):
    # Read-only convenience fields so the frontend can render rows
    # without joining tables itself.
    employee_username       = serializers.CharField(source='employee.username', read_only=True)
    employee_number         = serializers.CharField(source='employee.employee_number', read_only=True)
    competency_title        = serializers.CharField(source='competency.title', read_only=True)
    competency_reference    = serializers.CharField(source='competency.reference_number', read_only=True)
    requested_by_username   = serializers.CharField(source='requested_by.username', read_only=True, default=None)
    reviewed_by_username    = serializers.CharField(source='reviewed_by.username', read_only=True, default=None)
    percentage              = serializers.SerializerMethodField()

    # Writeable shortcuts for create() so the frontend can post by id.
    employee_id    = serializers.IntegerField(write_only=True, required=False)
    competency_id  = serializers.IntegerField(write_only=True, required=False)

    def get_percentage(self, obj):
        return obj.percentage

    class Meta:
        model = ManualCompetencyAward
        fields = [
            'id',
            'employee', 'employee_id', 'employee_username', 'employee_number',
            'competency', 'competency_id', 'competency_title', 'competency_reference',
            'score', 'max_score', 'level', 'notes',
            'status',
            'requested_by', 'requested_by_username', 'requested_at',
            'reviewed_by', 'reviewed_by_username', 'reviewed_at',
            'rejection_reason',
            'resulting_record',
            'percentage',
        ]
        read_only_fields = [
            'status',
            'requested_by', 'requested_at',
            'reviewed_by', 'reviewed_at',
            'rejection_reason',
            'resulting_record',
            'percentage',
            'employee_username', 'employee_number',
            'competency_title', 'competency_reference',
            'requested_by_username', 'reviewed_by_username',
            # employee and competency are also read-only in serializer
            # output but writable via the *_id shortcuts above.
            'employee', 'competency',
        ]


# ---------------------------------------------------------
# Permission helpers
# ---------------------------------------------------------

def _is_admin(user):
    return bool(user and user.is_authenticated and (
        getattr(user, 'role', None) == 'ADMIN' or user.is_superuser
    ))

def _is_manager(user):
    return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'MANAGER')

def _manager_manages_employee(manager, employee):
    """True if `manager` may submit awards for `employee`."""
    if not _is_manager(manager):
        return False
    try:
        managed = manager.managed_branches_qs()
        return (
            employee.employee_branch_id is not None
            and managed.filter(id=employee.employee_branch_id).exists()
        )
    except Exception:
        return False


# ---------------------------------------------------------
# Notification helpers (best-effort; never block the main action)
# ---------------------------------------------------------

def _notify(user, kind, title, body, link=''):
    if not user:
        return
    try:
        Notification.objects.create(
            user=user, kind=kind, title=title, body=body, link=link or '',
        )
    except Exception:
        pass


# ---------------------------------------------------------
# Views
# ---------------------------------------------------------

class ManualAwardListCreateView(APIView):
    """
    GET  /api/training/manual-awards/
         Admin sees all; manager sees their own submissions.
    POST /api/training/manual-awards/
         Manager submits a new pending award.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (_is_admin(user) or _is_manager(user)):
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        qs = ManualCompetencyAward.objects.select_related(
            'employee', 'competency', 'requested_by', 'reviewed_by',
        ).order_by('-requested_at')

        # Optional filter by status
        st = request.query_params.get('status')
        if st:
            qs = qs.filter(status=st.upper())

        if _is_manager(user):
            qs = qs.filter(requested_by=user)

        return Response(ManualCompetencyAwardSerializer(qs, many=True).data)

    def post(self, request):
        user = request.user
        if not _is_manager(user):
            return Response({'detail': 'Only managers can submit awards'},
                            status=status.HTTP_403_FORBIDDEN)

        emp_id = request.data.get('employee_id') or request.data.get('employee')
        comp_id = request.data.get('competency_id') or request.data.get('competency')
        if not emp_id or not comp_id:
            return Response(
                {'detail': 'employee_id and competency_id are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employee = get_object_or_404(User, pk=emp_id)
        competency = get_object_or_404(Competency, pk=comp_id)

        if not _manager_manages_employee(user, employee):
            return Response(
                {'detail': "You don't manage this employee's branch."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Validate numeric inputs
        try:
            score = float(request.data.get('score'))
        except (TypeError, ValueError):
            return Response({'detail': 'score must be a number.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            max_score = float(request.data.get('max_score') or 100)
        except (TypeError, ValueError):
            max_score = 100.0
        if max_score <= 0:
            return Response({'detail': 'max_score must be > 0.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if score < 0 or score > max_score:
            return Response({'detail': 'score must be between 0 and max_score.'},
                            status=status.HTTP_400_BAD_REQUEST)

        level = (request.data.get('level') or '').strip().upper() or None
        if level and level not in {'CL0', 'CL1', 'CL2', 'CL3', 'CL4'}:
            return Response({'detail': 'level must be one of CL0-CL4.'},
                            status=status.HTTP_400_BAD_REQUEST)

        award = ManualCompetencyAward.objects.create(
            employee=employee,
            competency=competency,
            score=score,
            max_score=max_score,
            level=level,
            notes=(request.data.get('notes') or '').strip(),
            requested_by=user,
        )

        # Best-effort: tell every admin a new award is waiting.
        for admin in User.objects.filter(role='ADMIN'):
            _notify(
                admin,
                Notification.Kind.GENERIC,
                'Manual award pending approval',
                f"{user.username} submitted a verbal-assessment award for "
                f"{employee.username} on '{competency.title}'.",
                link='/admin',
            )

        return Response(
            ManualCompetencyAwardSerializer(award).data,
            status=status.HTTP_201_CREATED,
        )


class ManualAwardPendingListView(APIView):
    """GET /api/training/manual-awards/pending/  - admin queue."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_admin(request.user):
            return Response({'detail': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
        qs = ManualCompetencyAward.objects.select_related(
            'employee', 'competency', 'requested_by',
        ).filter(status=ManualCompetencyAward.Status.PENDING).order_by('requested_at')
        return Response(ManualCompetencyAwardSerializer(qs, many=True).data)


class ManualAwardApproveView(APIView):
    """POST /api/training/manual-awards/<id>/approve/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if not _is_admin(request.user):
            return Response({'detail': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

        award = get_object_or_404(ManualCompetencyAward, pk=pk)
        if award.status != ManualCompetencyAward.Status.PENDING:
            return Response(
                {'detail': f'Award is already {award.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create the matching EmployeeCompetencyRecord so the score and
        # points count toward the employee's totals like a real exam pass.
        # EmployeeCompetencyRecord has unique_together (employee, competency),
        # so use update_or_create instead of create to handle the case where
        # the employee already has a record for this competency.
        comp = award.competency
        points = getattr(comp, 'priority_points', 0) or 0
        record, _ = EmployeeCompetencyRecord.objects.update_or_create(
            employee=award.employee,
            competency=comp,
            defaults={
                'status': 'PASSED',
                'score': award.score,
                'points_earned': points,
                'date_completed': timezone.now().date(),
            },
        )

        # Apply level override if the manager specified one.
        if award.level:
            award.employee.manual_level_override = award.level
            award.employee.save(update_fields=['manual_level_override'])

        award.status = ManualCompetencyAward.Status.APPROVED
        award.reviewed_by = request.user
        award.reviewed_at = timezone.now()
        award.resulting_record = record
        award.save(update_fields=[
            'status', 'reviewed_by', 'reviewed_at', 'resulting_record',
        ])

        # Notify the manager who submitted it
        _notify(
            award.requested_by,
            Notification.Kind.GENERIC,
            'Your manual award was approved',
            (
                f"Admin {request.user.username} approved your award for "
                f"{award.employee.username} on '{comp.title}'."
            ),
            link='/manager',
        )
        # Notify the employee too
        _notify(
            award.employee,
            Notification.Kind.EXAM_PASSED,
            f'Competency awarded - {comp.title}',
            (
                f"You were awarded '{comp.title}' via a verbal assessment. "
                f"Score: {award.score:g} / {award.max_score:g}."
            ),
            link='/',
        )

        return Response(ManualCompetencyAwardSerializer(award).data)


class ManualAwardRejectView(APIView):
    """POST /api/training/manual-awards/<id>/reject/  body: {reason}"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if not _is_admin(request.user):
            return Response({'detail': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

        award = get_object_or_404(ManualCompetencyAward, pk=pk)
        if award.status != ManualCompetencyAward.Status.PENDING:
            return Response(
                {'detail': f'Award is already {award.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = (request.data.get('reason') or '').strip()
        award.status = ManualCompetencyAward.Status.REJECTED
        award.reviewed_by = request.user
        award.reviewed_at = timezone.now()
        award.rejection_reason = reason
        award.save(update_fields=[
            'status', 'reviewed_by', 'reviewed_at', 'rejection_reason',
        ])

        _notify(
            award.requested_by,
            Notification.Kind.GENERIC,
            'Your manual award was rejected',
            (
                f"Admin {request.user.username} rejected your award for "
                f"{award.employee.username} on '{award.competency.title}'."
                + (f" Reason: {reason}" if reason else '')
            ),
            link='/manager',
        )

        return Response(ManualCompetencyAwardSerializer(award).data)
