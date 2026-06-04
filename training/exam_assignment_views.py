"""
Exam assignments: a manager publishes one exam to one specific employee
(instead of broadcasting it to everyone with a matching position).

Endpoints:
  POST   /api/training/exam-assignments/                 manager creates
  GET    /api/training/exam-assignments/                 list (admin: all;
                                                          manager: own)
  GET    /api/training/exam-assignments/mine/            employee's own
  GET    /api/training/exam-assignments/<id>/            detail
  POST   /api/training/exam-assignments/<id>/cancel/     manager cancels
                                                          (only while ASSIGNED)

Business rules:
  - Only managers / admins can create.
  - Only ONE open (ASSIGNED or STARTED) assignment per (employee, exam)
    at a time. Trying to create a second returns 409 with a clear
    message. After the previous one is COMPLETED / CANCELLED the
    manager can assign again (yearly retake, remediation, etc.).
  - A manager can only assign to employees in their own branches.

This module is self-contained (serializer + views in one place) so it
does not need to import from training/serializers.py, which has been
historically fragile on the build mount.
"""
import random

from rest_framework import serializers, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone

from accounts.models import User, Notification
from training.models import (
    ExamAssignment,
    ExamTemplate,
)


# ---------------------------------------------------------
# Serializer
# ---------------------------------------------------------

class ExamAssignmentSerializer(serializers.ModelSerializer):
    employee_username     = serializers.CharField(source='employee.username', read_only=True)
    employee_number       = serializers.CharField(source='employee.employee_number', read_only=True)
    exam_title            = serializers.CharField(source='exam.title', read_only=True)
    competency_title      = serializers.CharField(source='exam.competency.title', read_only=True, default=None)
    competency_reference  = serializers.CharField(source='exam.competency.reference_number', read_only=True, default=None)
    assigned_by_username  = serializers.CharField(source='assigned_by.username', read_only=True, default=None)
    is_open               = serializers.SerializerMethodField()

    # Writeable shortcuts for create() so the frontend can post by id.
    employee_id = serializers.IntegerField(write_only=True, required=False)
    exam_id     = serializers.IntegerField(write_only=True, required=False)

    def get_is_open(self, obj):
        return obj.is_open

    class Meta:
        model = ExamAssignment
        fields = [
            'id',
            'employee', 'employee_id', 'employee_username', 'employee_number',
            'exam', 'exam_id', 'exam_title',
            'competency_title', 'competency_reference',
            'assigned_by', 'assigned_by_username',
            'assigned_at',
            'due_date', 'notes',
            'shuffle_seed',
            'status', 'is_open',
            'session', 'started_at', 'completed_at',
        ]
        read_only_fields = [
            'employee', 'exam',
            'assigned_by', 'assigned_at',
            'shuffle_seed',
            'status',
            'session', 'started_at', 'completed_at',
            'employee_username', 'employee_number',
            'exam_title',
            'competency_title', 'competency_reference',
            'assigned_by_username',
            'is_open',
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

class ExamAssignmentListCreateView(APIView):
    """
    GET  /api/training/exam-assignments/
         Admin -> all. Manager -> assignments they made.
         Filter via ?employee=<id> or ?exam=<id> or ?status=<status>.
    POST /api/training/exam-assignments/
         Body: employee_id (required), exam_id (required), due_date?, notes?
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (_is_admin(user) or _is_manager(user)):
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        qs = ExamAssignment.objects.select_related(
            'employee', 'exam', 'exam__competency', 'assigned_by', 'session',
        ).order_by('-assigned_at')

        if _is_manager(user):
            qs = qs.filter(assigned_by=user)

        emp = request.query_params.get('employee')
        ex  = request.query_params.get('exam')
        st  = request.query_params.get('status')
        if emp: qs = qs.filter(employee_id=emp)
        if ex:  qs = qs.filter(exam_id=ex)
        if st:  qs = qs.filter(status=st.upper())

        return Response(ExamAssignmentSerializer(qs, many=True).data)

    def post(self, request):
        user = request.user
        if not (_is_admin(user) or _is_manager(user)):
            return Response({'detail': 'Only managers / admins can assign exams.'},
                            status=status.HTTP_403_FORBIDDEN)

        emp_id = request.data.get('employee_id') or request.data.get('employee')
        exam_id = request.data.get('exam_id') or request.data.get('exam')
        if not emp_id or not exam_id:
            return Response(
                {'detail': 'employee_id and exam_id are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employee = get_object_or_404(User, pk=emp_id)
        exam = get_object_or_404(ExamTemplate, pk=exam_id)

        # Managers can only assign to employees in their branches.
        if _is_manager(user) and not _manager_manages_employee(user, employee):
            return Response(
                {'detail': "You don't manage this employee's branch."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Enforce the one-open-per-pair rule.
        existing_open = ExamAssignment.objects.filter(
            employee=employee,
            exam=exam,
            status__in=[ExamAssignment.Status.ASSIGNED, ExamAssignment.Status.STARTED],
        ).first()
        if existing_open:
            return Response(
                {
                    'detail': (
                        f"{employee.username} already has an open assignment for "
                        f"'{exam.title}' (status={existing_open.status}). "
                        f"Wait for them to finish or cancel the previous one."
                    ),
                    'existing_id': existing_open.id,
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Optional fields
        due_date = request.data.get('due_date') or None
        notes = (request.data.get('notes') or '').strip()

        assignment = ExamAssignment.objects.create(
            employee=employee,
            exam=exam,
            assigned_by=user,
            due_date=due_date,
            notes=notes,
            # 64-bit positive int, plenty of entropy for a deterministic shuffle.
            shuffle_seed=random.randint(1, 2_147_483_647),
        )

        # Tell the employee their exam is waiting.
        _notify(
            employee,
            Notification.Kind.GENERIC,
            'New exam assigned',
            (
                f"{user.username} assigned you an exam: '{exam.title}'."
                + (f" Due by {due_date}." if due_date else '')
            ),
            link='/',
        )

        return Response(
            ExamAssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED,
        )


class ExamAssignmentDetailView(APIView):
    """GET /api/training/exam-assignments/<id>/ - one assignment."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        a = get_object_or_404(
            ExamAssignment.objects.select_related(
                'employee', 'exam', 'exam__competency', 'assigned_by', 'session',
            ),
            pk=pk,
        )
        u = request.user
        if not (_is_admin(u) or a.assigned_by_id == u.id or a.employee_id == u.id):
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        return Response(ExamAssignmentSerializer(a).data)


class MyExamAssignmentsView(APIView):
    """
    GET /api/training/exam-assignments/mine/
    Logged-in employee's own assignments (open ones first).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = ExamAssignment.objects.select_related(
            'exam', 'exam__competency', 'assigned_by',
        ).filter(employee=request.user).order_by(
            # Open ones first (ASSIGNED before STARTED before everything else),
            # newest within each group.
            'status', '-assigned_at',
        )
        return Response(ExamAssignmentSerializer(qs, many=True).data)


class ExamAssignmentCancelView(APIView):
    """
    POST /api/training/exam-assignments/<id>/cancel/
    Only allowed while status == ASSIGNED (not yet started). Once
    started, you must let it run to completion to keep the audit trail.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        a = get_object_or_404(ExamAssignment, pk=pk)
        u = request.user
        if not (_is_admin(u) or a.assigned_by_id == u.id):
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        if a.status != ExamAssignment.Status.ASSIGNED:
            return Response(
                {'detail': f"Can't cancel - status is {a.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        a.status = ExamAssignment.Status.CANCELLED
        a.save(update_fields=['status'])

        _notify(
            a.employee,
            Notification.Kind.GENERIC,
            'Exam assignment cancelled',
            f"Your assigned exam '{a.exam.title}' was cancelled by {u.username}.",
        )

        return Response(ExamAssignmentSerializer(a).data)
