from rest_framework.generics import RetrieveAPIView
from rest_framework import generics, permissions, status
from training.models import ExamTemplate
from training.serializers import ExamTemplateSerializer

# Place ExamTemplateDetailView after all imports so ExamTemplate is defined
class ExamTemplateDetailView(RetrieveAPIView):
    queryset = ExamTemplate.objects.all()
    serializer_class = ExamTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from django.utils import timezone
from datetime import date, timedelta
from training.models import (
    Competency,
    PositionCompetencyRequirement,
    EmployeeCompetencyRecord,
    ExamTemplate,
    Question,
    QuestionChoice,
    ExamSession,
    ExamAnswer,
        
    EmployeeCompetencyRequirement,
    Frequency,
)

from training.serializers import (
    CompetencySerializer,
    PositionCompetencyRequirementSerializer,
    EmployeeCompetencyRecordSerializer,
    ExamTemplateSerializer,
    QuestionSerializer,
    QuestionChoiceSerializer,
    ExamSessionSerializer,
    ExamSessionDetailSerializer,
    GradingQueueSessionSerializer,
    ExamSessionStartSerializer,
    SubmitExamSerializer,
    PublishRequirementsSerializer,
    LevelThresholdSettingSerializer,
    EmployeeCompetencyRequirementSerializer,
)
from training.permissions import CanManageModules, CanManageExams, CanManageQuestions
from training.permissions import AdminOnly
from accounts.models import User
from accounts.serializers import UserSerializer
from rest_framework import serializers
from django.db.models import Count
from accounts.models import Position
from training.models import LevelThresholdSetting
from branches.models import Branch
from django.shortcuts import get_object_or_404


# ---------------------------------------------------------
# COMPETENCY CRUD
# ---------------------------------------------------------

class CompetencyListCreateView(generics.ListCreateAPIView):
    queryset = Competency.objects.all()
    serializer_class = CompetencySerializer
    permission_classes = [CanManageModules]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CompetencyDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Competency.objects.all()
    serializer_class = CompetencySerializer
    permission_classes = [permissions.IsAuthenticated]


# ---------------------------------------------------------
# POSITION → COMPETENCY REQUIREMENTS
# ---------------------------------------------------------

class PositionCompetencyRequirementCreateView(generics.CreateAPIView):
    queryset = PositionCompetencyRequirement.objects.all()
    serializer_class = PositionCompetencyRequirementSerializer
    permission_classes = [CanManageModules]

    def perform_create(self, serializer):
        # If manager has multiple branches, branch is required
        user = self.request.user
        branch = None
        if user.is_manager():
            branches = list(user.managed_branches_qs())
            branch_id = serializer.validated_data.get("branch_id")
            if len(branches) == 1 and not branch_id:
                branch = branches[0]
            else:
                if not branch_id:
                    raise serializers.ValidationError({"branch_id": "Branch is required for managers with multiple branches."})
        serializer.save(branch=branch)


class PositionCompetencyRequirementListView(generics.ListAPIView):
    queryset = PositionCompetencyRequirement.objects.all()
    serializer_class = PositionCompetencyRequirementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Managers: restrict to their branches

        if user.is_manager():
            qs = qs.filter(branch__in=user.managed_branches_qs())
        # Filters
        branch_id = self.request.query_params.get("branch")
        position_id = self.request.query_params.get("position")
        competency_id = self.request.query_params.get("competency")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if position_id:
            qs = qs.filter(position_id=position_id)
        if competency_id:
            qs = qs.filter(competency_id=competency_id)
        return qs


class PositionCompetencyRequirementDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PositionCompetencyRequirementSerializer
    permission_classes = [CanManageModules]

    def get_queryset(self):
        qs = PositionCompetencyRequirement.objects.all()
        user = self.request.user
        if user.is_manager():
            qs = qs.filter(branch__in=user.managed_branches_qs())
        return qs


# ---------------------------------------------------------
# EMPLOYEE-SPECIFIC REQUIREMENTS
# ---------------------------------------------------------

class EmployeeRequirementView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        employee_id = request.query_params.get("employee_id")
        if not employee_id:
            return Response({"error": "employee_id is required"}, status=400)
        qs = EmployeeCompetencyRequirement.objects.filter(employee_id=employee_id).select_related("competency", "branch", "employee")
        user = request.user
        if user.is_manager():
            qs = qs.filter(branch__in=user.managed_branches_qs())
        data = EmployeeCompetencyRequirementSerializer(qs, many=True).data
        return Response({"results": data})

    def post(self, request):
        user = request.user
        data = request.data

        employee_id = data.get("employee_id")
        competency_id = data.get("competency_id")
        competency_ids = data.get("competency_ids") or []
        assignments = data.get("assignments")
        if competency_id:
            competency_ids.append(competency_id)
        # Normalize to list of ints
        competency_ids = [int(c) for c in competency_ids if c]
        if not employee_id and not assignments:
            return Response({"error": "employee_id is required"}, status=400)

        if assignments and not isinstance(assignments, list):
            return Response({"error": "assignments must be a list"}, status=400)

        employee = get_object_or_404(User, id=employee_id)

        def parse_branch(val):
            if val in ["", None]:
                return None
            try:
                return int(val)
            except (TypeError, ValueError):
                return "invalid"

        # Build base branch (global override or employee branch)
        base_branch_id_raw = data.get("branch_id")
        base_branch_id = parse_branch(base_branch_id_raw)
        if base_branch_id == "invalid":
            return Response({"error": "branch_id must be numeric"}, status=400)
        branch_obj = None
        if base_branch_id:
            branch_obj = get_object_or_404(Branch, id=base_branch_id)
        elif employee.employee_branch_id:
            branch_obj = employee.employee_branch

        # Managers can only assign within their branches
        def assert_branch_allowed(target_branch):
            if not user.is_manager():
                return
            allowed_ids = user.managed_branch_ids()
            if not allowed_ids:
                raise permissions.PermissionDenied("No manager branches configured")
            if target_branch is None:
                raise permissions.PermissionDenied("Branch is required")
            if target_branch.id not in allowed_ids:
                raise permissions.PermissionDenied("Not allowed to assign outside your branches")

        results = []

        # Prefer assignments payload (per-competency settings); fallback to legacy list
        if assignments:
            for item in assignments:
                cid = item.get("competency_id")
                if not cid:
                    continue
                comp = get_object_or_404(Competency, id=int(cid))
                item_branch_id_raw = item.get("branch_id")
                item_branch_id = parse_branch(item_branch_id_raw)
                if item_branch_id == "invalid":
                    return Response({"error": f"branch_id must be numeric for competency {cid}"}, status=400)
                item_branch = get_object_or_404(Branch, id=item_branch_id) if item_branch_id else branch_obj
                assert_branch_allowed(item_branch)
                payload = {
                    "employee_id": employee.id,
                    "competency_id": comp.id,
                    "branch_id": item_branch.id if item_branch else None,
                    "frequency": item.get("frequency") or data.get("frequency"),
                    "priority_points": item.get("priority_points", data.get("priority_points", 0)),
                    "required": bool(item.get("required", data.get("required", True))),
                }
                serializer = EmployeeCompetencyRequirementSerializer(data=payload)
                serializer.is_valid(raise_exception=True)
                obj = serializer.save()
                results.append(EmployeeCompetencyRequirementSerializer(obj).data)
        else:
            competencies = [get_object_or_404(Competency, id=cid) for cid in competency_ids]

            for comp in competencies:
                assert_branch_allowed(branch_obj)
                payload = {
                    "employee_id": employee.id,
                    "competency_id": comp.id,
                    "branch_id": branch_obj.id if branch_obj else None,
                    "frequency": data.get("frequency"),
                    "priority_points": data.get("priority_points", 0),
                    "required": bool(data.get("required", True)),
                }

                serializer = EmployeeCompetencyRequirementSerializer(data=payload)
                serializer.is_valid(raise_exception=True)
                obj = serializer.save()
                results.append(EmployeeCompetencyRequirementSerializer(obj).data)


        return Response({"results": results}, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------
# EXPIRING COMPETENCIES (ADMIN/MANAGER)
# ---------------------------------------------------------

class ExpiringCompetenciesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _normalize_int(self, val):
        if val in [None, ""]:
            return None
        try:
            return int(val)
        except (TypeError, ValueError):
            return "invalid"

    def _compute_expiry(self, completed, freq):
        if not completed:
            return None
        d = completed
        if hasattr(completed, "date"):
            d = completed.date()
        if freq == Frequency.YEARLY:
            return d + timedelta(days=365)
        return None

    def _serialize_item(self, employee, requirement, record, expiry_date, days_remaining):
        return {
            "employee": {
                "id": employee.id,
                "username": employee.username,
                "employee_number": employee.employee_number,
            },
            "branch": {
                "id": requirement.branch_id,
                "name": getattr(requirement.branch, "name", None),
            },
            "position": {
                "id": requirement.position_id,
                "name": getattr(requirement.position, "name", None),
            },
            "competency": {
                "id": requirement.competency_id,
                "title": getattr(requirement.competency, "title", None),
                "reference_number": getattr(requirement.competency, "reference_number", None),
            },
            "expiry_date": expiry_date,
            "days_remaining": days_remaining,
            "status": getattr(record, "status", EmployeeCompetencyRecord.Status.NOT_STARTED),
        }

    def get(self, request):
        user = request.user
        if not (user.is_admin() or user.is_manager()):
            return Response({"error": "Only managers/admins can view expiring competencies"}, status=403)

        branch_id_raw = request.query_params.get("branch")
        position_id_raw = request.query_params.get("position")
        window_raw = request.query_params.get("window", 90)

        branch_id = self._normalize_int(branch_id_raw)
        position_id = self._normalize_int(position_id_raw)
        if branch_id == "invalid" or position_id == "invalid":
            return Response({"error": "branch/position must be numeric"}, status=400)
        try:
            window_days = max(1, min(365, int(window_raw)))
        except (TypeError, ValueError):
            window_days = 90

        req_qs = PositionCompetencyRequirement.objects.filter(required=True)
        if user.is_manager():
            req_qs = req_qs.filter(branch__in=user.managed_branches_qs())
            if branch_id and branch_id not in user.managed_branch_ids():
                return Response({"error": "Not allowed to view other branches"}, status=403)
        if branch_id:
            req_qs = req_qs.filter(branch_id=branch_id)
        if position_id:
            req_qs = req_qs.filter(position_id=position_id)

        emp_qs = User.objects.filter(role=User.Roles.EMPLOYEE)
        if user.is_manager():
            emp_qs = emp_qs.filter(employee_branch__in=user.managed_branches_qs())
        if branch_id:
            emp_qs = emp_qs.filter(employee_branch_id=branch_id)
        if position_id:
            emp_qs = emp_qs.filter(position_id=position_id)

        employees = {e.id: e for e in emp_qs.select_related("position", "employee_branch")}

        today = date.today()
        expiring = []
        overdue = []

        for r in req_qs.select_related("competency", "position", "branch"):
            freq = r.frequency or getattr(r.competency, "frequency", None)
            if freq != Frequency.YEARLY:
                continue

            for e in employees.values():
                if getattr(e, "position_id", None) != r.position_id:
                    continue
                if getattr(e, "employee_branch_id", None) != r.branch_id:
                    continue

                rec = EmployeeCompetencyRecord.objects.filter(employee=e, competency=r.competency).order_by("-date_completed").first()
                expiry_date = self._compute_expiry(getattr(rec, "date_completed", None), freq)
                if not expiry_date:
                    overdue.append(self._serialize_item(e, r, rec, None, None))
                    continue

                days_remaining = (expiry_date - today).days
                item = self._serialize_item(e, r, rec, expiry_date, days_remaining)
                if days_remaining < 0:
                    overdue.append(item)
                elif days_remaining <= window_days:
                    expiring.append(item)

        expiring.sort(key=lambda x: x.get("days_remaining") if x.get("days_remaining") is not None else 99999)
        overdue.sort(key=lambda x: x.get("days_remaining") if x.get("days_remaining") is not None else -99999)

        return Response({
            "expiring": expiring,
            "overdue": overdue,
            "window_days": window_days,
        })

    def post(self, request):
        user = request.user
        if not (user.is_admin() or user.is_manager()):
            return Response({"error": "Only managers/admins can update expiring competencies"}, status=403)
        action = request.data.get("action")
        if action != "retrain":
            return Response({"error": "Unsupported action"}, status=400)

        emp_id = request.data.get("employee_id")
        comp_id = request.data.get("competency_id")
        if not emp_id or not comp_id:
            return Response({"error": "employee_id and competency_id are required"}, status=400)

        employee = get_object_or_404(User, id=emp_id)
        if user.is_manager():
            allowed = user.managed_branch_ids()
            if employee.employee_branch_id and employee.employee_branch_id not in allowed:
                return Response({"error": "Not allowed to modify other branches"}, status=403)

        rec, _ = EmployeeCompetencyRecord.objects.get_or_create(employee=employee, competency_id=comp_id)
        rec.status = EmployeeCompetencyRecord.Status.RETRAIN
        rec.save(update_fields=["status"])
        return Response({"message": "Marked as retrain"})


# ---------------------------------------------------------
# EMPLOYEE COMPETENCY PROGRESS
# ---------------------------------------------------------

from rest_framework.response import Response
from rest_framework.views import APIView

class MyCompetenciesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        # Get all required competencies for user's position and branch
        position = getattr(user, 'position', None)
        branch = getattr(user, 'employee_branch', None)
        required_comps = []
        if position and branch:
            required_comps = PositionCompetencyRequirement.objects.filter(
                position=position, branch=branch, required=True
            ).select_related('competency')
        # Get all employee-specific requirements
        emp_specific = EmployeeCompetencyRequirement.objects.filter(
            employee=user, required=True
        ).select_related('competency')
        # Merge all required competencies (by id)
        all_required = {r.competency.id: r.competency for r in required_comps if r.competency}
        for e in emp_specific:
            if e.competency:
                all_required[e.competency.id] = e.competency
        # Get all EmployeeCompetencyRecords for user
        records = EmployeeCompetencyRecord.objects.filter(employee=user)
        record_map = {rec.competency_id: rec for rec in records}
        # Build response: for each required competency, return record if exists, else dummy record
        from training.serializers import EmployeeCompetencyRecordSerializer, CompetencySerializer
        result = []
        for comp_id, comp in all_required.items():
            rec = record_map.get(comp_id)
            if rec:
                data = EmployeeCompetencyRecordSerializer(rec).data
            else:
                # Build a dummy record with status NOT_STARTED
                data = {
                    'id': None,
                    'employee': None,
                    'competency': CompetencySerializer(comp).data,
                    'status': 'NOT_STARTED',
                    'score': 0,
                    'points_earned': 0,
                    'date_completed': None,
                    'week': None,
                    'period': None,
                    'quarter': None,
                    'attempts_count': 0,
                }
            result.append(data)
        # Optionally, include records for competencies not required but already completed by user
        for rec in records:
            if rec.competency_id not in all_required:
                data = EmployeeCompetencyRecordSerializer(rec).data
                result.append(data)
        return Response(result)


# ---------------------------------------------------------
# EXAM TEMPLATE CRUD
# ---------------------------------------------------------

class ExamTemplateCreateView(generics.CreateAPIView):
    queryset = ExamTemplate.objects.all()
    serializer_class = ExamTemplateSerializer
    permission_classes = [CanManageExams]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ExamTemplateListView(generics.ListAPIView):
    queryset = ExamTemplate.objects.all()
    serializer_class = ExamTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        import logging
        logger = logging.getLogger("training.exam_debug")
        qs = ExamTemplate.objects.filter(is_active=True)
        user = self.request.user
        branch_param = self.request.query_params.get("branch")
        competency_param = self.request.query_params.get("competency")
        position_param = self.request.query_params.get("position")

        logger.info(f"ExamTemplateListView.get_queryset called by user {user} (role={getattr(user, 'role', None)})")
        logger.info(f"Params: branch={branch_param}, competency={competency_param}, position={position_param}")

        if user.is_admin() or user.is_manager():
            if competency_param:
                qs = qs.filter(competency_id=competency_param)
            if user.is_manager():
                from training.models import PositionCompetencyRequirement
                from django.db.models import Q
                # Manager's allowed branches = manager_branches M2M ∪ employee_branch
                allowed_branch_ids = user.managed_branch_ids()
                if getattr(user, 'employee_branch_id', None):
                    allowed_branch_ids.add(user.employee_branch_id)
                req_filter_branches = [branch_param] if branch_param else list(allowed_branch_ids)
                allowed = PositionCompetencyRequirement.objects.filter(
                    branch_id__in=req_filter_branches
                )
                if position_param:
                    allowed = allowed.filter(position_id=position_param)
                allowed_competency_ids = list(allowed.values_list("competency_id", flat=True))
                # A manager sees exams whose competency is in their published
                # requirements OR exams they created themselves - otherwise a
                # brand-new exam disappears until a requirement is published.
                qs = qs.filter(
                    Q(competency_id__in=allowed_competency_ids) | Q(created_by=user)
                ).distinct()
            return qs

        # Employees: only exams for their position/branch via requirements
        from training.models import PositionCompetencyRequirement
        competency_ids = list(PositionCompetencyRequirement.objects.filter(
            position=user.position,
            branch=user.employee_branch,
        ).values_list("competency_id", flat=True))
        logger.info(f"Employee allowed competency_ids: {competency_ids}")
        result = qs.filter(competency_id__in=competency_ids)
        logger.info(f"Returning queryset count: {result.count()}")
        return result


# ---------------------------------------------------------
# QUESTIONS + CHOICES
# ---------------------------------------------------------

class QuestionListCreateView(generics.ListCreateAPIView):
    serializer_class = QuestionSerializer
    permission_classes = [CanManageQuestions]

    def get_queryset(self):
        exam_id = self.request.query_params.get("exam")
        if exam_id:
            return Question.objects.filter(exam_id=exam_id).order_by("order")
        return Question.objects.all().order_by("order")


class QuestionChoiceListCreateView(generics.ListCreateAPIView):
    serializer_class = QuestionChoiceSerializer
    permission_classes = [CanManageQuestions]

    def get_queryset(self):
        question_id = self.request.query_params.get("question")
        if question_id:
            return QuestionChoice.objects.filter(question_id=question_id)
        return QuestionChoice.objects.all()

# ---------------------------------------------------------
# EXAM SESSION (START EXAM)
# ---------------------------------------------------------

import logging

class StartExamSessionView(generics.CreateAPIView):
    queryset = ExamSession.objects.all()
    serializer_class = ExamSessionStartSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        print("[DEBUG] StartExamSessionView.create called")
        print(f"[DEBUG] User: {request.user} (id={getattr(request.user, 'id', None)})")
        print(f"[DEBUG] Data: {request.data}")
        response = super().create(request, *args, **kwargs)
        print(f"[DEBUG] Response status: {response.status_code}")
        print(f"[DEBUG] Response data: {getattr(response, 'data', None)}")
        return response


class MyExamSessionsView(generics.ListAPIView):
    serializer_class = ExamSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ExamSession.objects.filter(employee=self.request.user)


# ---------------------------------------------------------
# MANAGER SESSIONS LIST (BY BRANCH)
# ---------------------------------------------------------

class ManagerExamSessionsView(generics.ListAPIView):
    serializer_class = ExamSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ExamSession.objects.all().select_related("employee", "exam")
        if user.is_admin():
            pass
        elif user.is_manager():
            qs = qs.filter(employee__employee_branch__in=user.managed_branches_qs())
        else:
            return ExamSession.objects.none()

        status_param = self.request.query_params.get("status")
        branch_id = self.request.query_params.get("branch")
        employee_id = self.request.query_params.get("employee")
        exam_id = self.request.query_params.get("exam")
        if status_param:
            qs = qs.filter(status=status_param)
        if branch_id:
            qs = qs.filter(employee__employee_branch_id=branch_id)
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if exam_id:
            qs = qs.filter(exam_id=exam_id)
        return qs


class ManagerExamSessionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        base_qs = ExamSession.objects.select_related("employee", "exam").prefetch_related(
            "answers__question__choices",
            "answers__selected_choices",
        )

        if user.is_admin():
            session = get_object_or_404(base_qs, pk=pk)
        elif user.is_manager():
            session = get_object_or_404(base_qs.filter(employee__employee_branch__in=user.managed_branches_qs()), pk=pk)
        else:
            # Employees can view their own session detail (review page).
            session = get_object_or_404(base_qs.filter(employee=user), pk=pk)

        data = ExamSessionDetailSerializer(session).data
        return Response(data)


class ManagerGradingQueueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_admin() or user.is_manager()):
            return Response({"error": "Not allowed"}, status=403)

        base_qs = ExamSession.objects.filter(status=ExamSession.Status.SUBMITTED).select_related(
            "employee",
            "employee__employee_branch",
            "exam",
        ).prefetch_related("answers__question", "answers__selected_choices")

        if user.is_manager():
            base_qs = base_qs.filter(employee__employee_branch__in=user.managed_branches_qs())

        sessions = list(base_qs)

        # Attach prefetched answers to avoid repeated queries in serializer manual checks
        for s in sessions:
            s._prefetched_answers = list(s.answers.all())

        manual_needed_count = sum(1 for s in sessions if any((not a.is_auto_graded()) and a.points_awarded is None for a in s._prefetched_answers))
        auto_only_count = sum(1 for s in sessions if all(a.is_auto_graded() for a in s._prefetched_answers))

        data = GradingQueueSessionSerializer(sessions, many=True).data
        return Response({
            "manual_needed": manual_needed_count,
            "auto_only": auto_only_count,
            "results": data,
        })


# ---------------------------------------------------------
# SUBMIT EXAM + AUTO-GRADE
# ---------------------------------------------------------

class SubmitExamView(APIView):
    permission_classes = [permissions.IsAuthenticated]


    def post(self, request):
        session_id = request.data.get("session_id")
        answers = request.data.get("answers", [])

        # 1. Load the exam session
        try:
            session = ExamSession.objects.get(id=session_id, employee=request.user)
        except ExamSession.DoesNotExist:
            # Debug: log session_id, current user, and session owner if exists
            from django.contrib.auth import get_user_model
            import sys
            User = get_user_model()
            session_owner = None
            try:
                s = ExamSession.objects.get(id=session_id)
                session_owner = s.employee.username
            except Exception:
                session_owner = None
            print(f"[DEBUG] Invalid session submit: session_id={session_id}, current_user={request.user.username}, session_owner={session_owner}", file=sys.stderr)
            return Response({"error": "Invalid session", "debug": {
                "session_id": session_id,
                "current_user": request.user.username,
                "session_owner": session_owner
            }}, status=400)

        exam = session.exam
        employee = request.user

        # Check expiry (we still accept and grade, but mark expired in response)
        expired = session.is_expired()

        # 2. Persist answers and auto-grade objective questions
        total_score = 0.0
        max_score = 0.0
        from training.models import ExamAnswer, QuestionChoice

        # Clear existing answers for a re-submit attempt, if any
        session.answers.all().delete()

        for item in answers:
            question = Question.objects.get(id=item["question"])
            ans = ExamAnswer.objects.create(
                session=session,
                question=question,
                text_answer=item.get("text_answer", ""),
            )
            choice_ids = item.get("selected_choices", [])
            if choice_ids:
                choices = QuestionChoice.objects.filter(id__in=choice_ids, question=question)
                ans.selected_choices.set(choices)

            # Track totals
            max_score += float(question.max_points)

            # Auto-grade if applicable
            auto_points = ans.auto_score()
            if auto_points is not None:
                ans.points_awarded = auto_points
                ans.save()
                total_score += float(auto_points)

        # Always SUBMITTED on submit (even if time was up). The EXPIRED
        # status is reserved for duplicate-session cleanup, and we now
        # hide EXPIRED rows from the employee/manager history views.
        session.score = total_score
        session.max_score = max_score
        session.status = ExamSession.Status.SUBMITTED
        session.submitted_at = timezone.now()
        session.save()

        # Clean up any other open sessions for the same (exam, employee)
        # so the history only shows this real submission.
        ExamSession.objects.filter(
            exam=exam, employee=employee,
            status=ExamSession.Status.IN_PROGRESS,
        ).exclude(pk=session.pk).update(status=ExamSession.Status.EXPIRED)

        # Increment attempts on record for tracking
        record, _ = EmployeeCompetencyRecord.objects.get_or_create(
            employee=employee,
            competency=exam.competency,
        )
        record.attempts_count = (record.attempts_count or 0) + 1
        record.save(update_fields=["attempts_count"])

        return Response({
            "session_id": session.id,
            "status": session.status,
            "score": float(total_score),
            "max_score": float(max_score),
            "expired": expired,
        })


# ---------------------------------------------------------
# MANAGER MANUAL GRADING (OPTIONAL)
# ---------------------------------------------------------

class GradeExamView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = ExamSession.objects.get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)

        # Managers can only grade within their branches; admins can grade any
        user = request.user
        if user.is_manager():
            employee_branch = getattr(session.employee, "employee_branch", None)
            if not employee_branch or employee_branch not in user.managed_branches_qs():
                return Response({"error": "Not allowed to grade this session"}, status=403)

        if session.status not in [ExamSession.Status.SUBMITTED, ExamSession.Status.GRADED]:
            return Response({"error": "Exam must be submitted first"}, status=400)

        # Optional override of status by manager; else threshold pass/fail
        override_status = request.data.get("status")  # PASSED/FAILED

        # Recompute final totals from answers
        session.calculate_final_score()

        exam = session.exam
        employee = session.employee
        competency = exam.competency

        pct = (session.score / session.max_score * 100.0) if session.max_score else 0.0
        passed = pct >= 60.0 if not override_status else (override_status == "PASSED")

        # Update competency record points based on requirement for position & branch
        from training.models import PositionCompetencyRequirement
        requirement = PositionCompetencyRequirement.objects.filter(
            position=employee.position,
            competency=competency,
            branch=employee.employee_branch,
        ).first()
        # Cross-training fallback: if no requirement, use competency.priority_points
        priority_points = requirement.priority_points if requirement else (competency.priority_points or 0)

        record, _ = EmployeeCompetencyRecord.objects.get_or_create(
            employee=employee,
            competency=competency,
        )
        record.score = session.score or 0
        if passed:
            record.status = EmployeeCompetencyRecord.Status.PASSED
            record.points_earned = priority_points
            record.date_completed = timezone.now().date()
        else:
            # Only set to FAILED if not already PASSED
            if record.status != EmployeeCompetencyRecord.Status.PASSED:
                record.status = EmployeeCompetencyRecord.Status.FAILED
            record.points_earned = record.points_earned or 0
        record.save()

        # ----- Notify the employee that their exam was graded -----
        try:
            from accounts.models import Notification
            score = float(session.score or 0)
            max_score = float(session.max_score or 0)
            pct_int = int(round(pct))
            verdict = "PASSED" if passed else "FAILED"
            kind = (
                Notification.Kind.EXAM_PASSED if passed
                else Notification.Kind.EXAM_FAILED
            )
            Notification.objects.create(
                user=employee,
                kind=kind,
                title=f"Your exam was graded - {verdict}",
                body=(
                    f"'{exam.title}' was graded by your manager. "
                    f"Score: {score:g} / {max_score:g} ({pct_int}%)."
                ),
                link=f"/exam/review/{session.id}",
            )
        except Exception:
            # Notifications are best-effort - never block a successful grade.
            pass

        return Response({
            "message": "Exam graded successfully",
            "final_score": float(session.score or 0),
            "max_score": float(session.max_score or 0),
            "passed": passed,
            "points_earned": record.points_earned,
        })


class GradeAnswerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from training.models import ExamAnswer
        answer_id = request.data.get("answer_id")
        points = request.data.get("points_awarded")
        comment = request.data.get("manager_comment", "")

        if answer_id is None or points is None:
            return Response({"error": "answer_id and points_awarded are required"}, status=400)

        try:
            ans = ExamAnswer.objects.select_related("session", "session__employee").get(id=answer_id)
        except ExamAnswer.DoesNotExist:
            return Response({"error": "Answer not found"}, status=404)

        user = request.user
        if user.is_manager():
            employee_branch = getattr(ans.session.employee, "employee_branch", None)
            if not employee_branch or employee_branch not in user.managed_branches_qs():
                return Response({"error": "Not allowed to grade this answer"}, status=403)

        ans.points_awarded = float(points)
        ans.manager_comment = comment
        ans.save()

        return Response({"message": "Answer graded"})


# ---------------------------------------------------------
# ALLOW RETAKE (Manager grants a failed employee a fresh attempt)
# ---------------------------------------------------------

class AllowRetakeView(APIView):
    """Manager/Admin flips ``retake_allowed`` on a failed ExamSession and
    creates a brand-new IN_PROGRESS session for the same employee/exam.

    The original failed session is preserved as history so reporting still
    shows the failed attempt.  When the employee submits the new session,
    that new session is what gets graded - and only if it passes do points
    get awarded.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        try:
            failed_session = ExamSession.objects.select_related(
                "exam", "employee", "employee__employee_branch"
            ).get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)

        user = request.user
        # Only admins and managers (for their own branches) can grant retakes
        if user.is_manager() and not user.is_admin():
            employee_branch = getattr(failed_session.employee, "employee_branch", None)
            if not employee_branch or employee_branch not in user.managed_branches_qs():
                return Response(
                    {"error": "Not allowed to allow retake for this session"},
                    status=403,
                )
        elif not user.is_admin():
            return Response({"error": "Not allowed"}, status=403)

        # Session must already be graded
        if failed_session.status != ExamSession.Status.GRADED:
            return Response(
                {"error": "Exam must be graded before a retake can be granted."},
                status=400,
            )

        # Only failed sessions are eligible for retake
        pct = (
            (failed_session.score / failed_session.max_score * 100.0)
            if failed_session.max_score
            else 0.0
        )
        if pct >= 60.0:
            return Response(
                {"error": "This exam was passed - no retake needed."},
                status=400,
            )

        # Flag the failed session and clean up any orphan open sessions
        failed_session.retake_allowed = True
        failed_session.save(update_fields=["retake_allowed"])

        exam = failed_session.exam
        employee = failed_session.employee

        # If a fresh retake is already pending, reuse it
        new_session = (
            ExamSession.objects
            .filter(
                exam=exam,
                employee=employee,
                status=ExamSession.Status.IN_PROGRESS,
                parent_session=failed_session,
            )
            .order_by("-started_at")
            .first()
        )
        if new_session is None:
            # Expire any stray IN_PROGRESS for this (exam, employee) so we
            # never end up with two competing open sessions.
            ExamSession.objects.filter(
                exam=exam,
                employee=employee,
                status=ExamSession.Status.IN_PROGRESS,
            ).update(status=ExamSession.Status.EXPIRED)

            new_session = ExamSession.objects.create(
                exam=exam,
                employee=employee,
                parent_session=failed_session,
            )

        # Notify the employee
        try:
            from accounts.models import Notification
            Notification.objects.create(
                user=employee,
                kind=Notification.Kind.EXAM_GRADED,
                title="Retake unlocked",
                body=(
                    f"Your manager has allowed you to retake '{exam.title}'. "
                    "The previous attempt remains in your history."
                ),
                link=f"/employee/exam/{exam.id}",
            )
        except Exception:
            pass

        return Response({
            "message": "Retake granted",
            "original_session_id": failed_session.id,
            "new_session_id": new_session.id,
            "exam_id": exam.id,
        })


# ---------------------------------------------------------
# COMPETENCY RECORDS REPORT (FILTERABLE)
# ---------------------------------------------------------

class CompetencyRecordListView(generics.ListAPIView):
    serializer_class = EmployeeCompetencyRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = EmployeeCompetencyRecord.objects.select_related("employee", "competency")
        user = self.request.user
        if user.is_admin():
            pass
        elif user.is_manager():
            qs = qs.filter(employee__employee_branch__in=user.managed_branches_qs())
        else:
            qs = qs.filter(employee=user)

        branch_id = self.request.query_params.get("branch")
        employee_id = self.request.query_params.get("employee")
        position_id = self.request.query_params.get("position")
        competency_id = self.request.query_params.get("competency")
        status_param = self.request.query_params.get("status")
        frequency = self.request.query_params.get("frequency")

        if branch_id:
            qs = qs.filter(employee__employee_branch_id=branch_id)
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if position_id:
            qs = qs.filter(employee__position_id=position_id)
        if competency_id:
            qs = qs.filter(competency_id=competency_id)
        if status_param:
            qs = qs.filter(status=status_param)
        if frequency:
            qs = qs.filter(competency__frequency=frequency)

        # Optional: filter by computed competency level
        level = self.request.query_params.get("level")
        if level:
            employees = {rec.employee for rec in qs}
            user_ids = [u.id for u in employees if getattr(u, "get_competency_level", None) and u.get_competency_level() == level]
            qs = qs.filter(employee_id__in=user_ids)

        return qs


# ---------------------------------------------------------
# PUBLISH REQUIREMENTS (BULK)
# ---------------------------------------------------------

class PublishRequirementsView(APIView):
    permission_classes = [CanManageModules]

    def post(self, request):
        serializer = PublishRequirementsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        branch_id = data["branch_id"]
        competency_id = data["competency_id"]
        position_ids = data["position_ids"]
        frequency = data.get("frequency")
        priority_points = data.get("priority_points")
        required = data.get("required")

        user = request.user
        if user.is_manager() and not branch_id in user.managed_branch_ids():
            return Response({"error": "Not allowed to publish to this branch"}, status=403)

        created = 0
        updated = 0
        items = []
        for pid in position_ids:
            obj, was_created = PositionCompetencyRequirement.objects.get_or_create(
                position_id=pid,
                competency_id=competency_id,
                branch_id=branch_id,
                defaults={
                    "frequency": frequency,
                    "priority_points": priority_points or 0,
                    "required": required if required is not None else True,
                },
            )
            if not was_created:
                changed = False
                if frequency is not None:
                    obj.frequency = frequency; changed = True
                if priority_points is not None:
                    obj.priority_points = priority_points; changed = True
                if required is not None:
                    obj.required = required; changed = True
                if changed:
                    obj.save(); updated += 1
                else:
                    updated += 1
            else:
                created += 1
            items.append({
                "id": obj.id,
                "position_id": pid,
                "competency_id": competency_id,
                "branch_id": branch_id,
                "frequency": obj.frequency,
                "priority_points": obj.priority_points,
                "required": obj.required,
            })

        return Response({
            "created": created,
            "updated": updated,
            "items": items,
        })


# ---------------------------------------------------------
# DASHBOARD SUMMARY
# 


         
class DashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.is_admin() or user.is_manager():
            scope_filter = {}
            if user.is_manager():
                scope_filter = {"employee__employee_branch__in": user.managed_branches_qs()}
            sessions_qs = ExamSession.objects.filter(**scope_filter)
            records_qs = EmployeeCompetencyRecord.objects.filter(**scope_filter)
            resp = {
                "sessions_by_status": list(sessions_qs.values("status").annotate(count=Count("id"))),
                "records_by_status": list(records_qs.values("status").annotate(count=Count("id"))),
                "exams_active_count": ExamTemplate.objects.filter(is_active=True).count(),
                "competencies_count": Competency.objects.count(),
            }
            return Response(resp)

        # Employee summary
        total_points = user.get_total_points()
        level = user.get_competency_level()
        my_records = EmployeeCompetencyRecord.objects.filter(employee=user)
        resp = {
            "total_points": total_points,
            "competency_level": level,
            "records_by_status": list(my_records.values("status").annotate(count=Count("id"))),
            "my_sessions_by_status": list(ExamSession.objects.filter(employee=user).values("status").annotate(count=Count("id"))),
        }
        return Response(resp)


# ---------------------------------------------------------
# NON-COMPLIANCE REPORT (MISSING REQUIRED COURSES/EXAMS)
# ---------------------------------------------------------

class NonComplianceReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_admin() or user.is_manager()):
            return Response({"error": "Not allowed"}, status=403)

        branch_id = request.query_params.get("branch")
        position_id = request.query_params.get("position")

        # Required mappings in scope
        req_qs = PositionCompetencyRequirement.objects.filter(required=True)
        if user.is_manager():
            req_qs = req_qs.filter(branch__in=user.managed_branches_qs())
        if branch_id:
            req_qs = req_qs.filter(branch_id=branch_id)
        if position_id:
            req_qs = req_qs.filter(position_id=position_id)

        # Employees in scope
        emp_qs = User.objects.filter(role=User.Roles.EMPLOYEE)
        if user.is_manager():
            emp_qs = emp_qs.filter(employee_branch__in=user.managed_branches_qs())
        if branch_id:
            emp_qs = emp_qs.filter(employee_branch_id=branch_id)
        if position_id:
            emp_qs = emp_qs.filter(position_id=position_id)

        requirements_by_key = {}
        for r in req_qs.select_related("competency", "position", "branch"):
            key = (r.position_id, r.branch_id)
            requirements_by_key.setdefault(key, []).append(r)

        non_compliant = []
        total_checked = 0

        # Rank levels to compare min_required_level
        level_rank = {"CL0": 0, "CL1": 1, "CL2": 2, "CL3": 3, "CL4": 4}

        for emp in emp_qs.select_related("position", "employee_branch"):
            total_checked += 1
            key = (getattr(emp.position, "id", None), getattr(emp.employee_branch, "id", None))
            reqs = requirements_by_key.get(key, [])
            missing = []

            for r in reqs:
                has_passed = EmployeeCompetencyRecord.objects.filter(
                    employee=emp,
                    competency=r.competency,
                    status=EmployeeCompetencyRecord.Status.PASSED,
                ).exists()
                if not has_passed:
                    missing.append({
                        "id": r.competency_id,
                        "title": r.competency.title if r.competency else None,
                        "reference_number": r.competency.reference_number if r.competency else None,
                    })

            below_min_level = False
            if emp.position and getattr(emp.position, "min_required_level", None):
                try:
                    current = level_rank.get(emp.get_competency_level(), 0)
                    required = level_rank.get(emp.position.min_required_level, 0)
                    below_min_level = current < required
                except Exception:
                    below_min_level = False

            if missing or below_min_level:
                non_compliant.append({
                    "employee_id": emp.id,
                    "username": emp.username,
                    "position": emp.position.name if emp.position else None,
                    "branch": emp.employee_branch.name if emp.employee_branch else None,
                    "missing_competencies": missing,
                    "below_min_level": below_min_level,
                })

        return Response({
            "total_employees_checked": total_checked,
            "non_compliant_count": len(non_compliant),
            "non_compliant": non_compliant,
        })


# ---------------------------------------------------------
# EMPLOYEE ACTIVITY (ADMIN/MANAGER)
# ---------------------------------------------------------

class EmployeeActivityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_admin() or user.is_manager()):
            return Response({"error": "Not allowed"}, status=403)

        emp_id = request.query_params.get("id")
        emp_no = request.query_params.get("employee_number")

        try:
            if emp_id:
                employee = User.objects.select_related("position", "employee_branch").get(id=emp_id)
            elif emp_no:
                employee = User.objects.select_related("position", "employee_branch").get(employee_number=emp_no)
            else:
                return Response({"error": "Provide id or employee_number"}, status=400)
        except User.DoesNotExist:
            return Response({"error": "Employee not found"}, status=404)

        # Managers may only view employees within their branches
        if user.is_manager():
            if not employee.employee_branch or employee.employee_branch not in user.managed_branches_qs():
                return Response({"error": "Not allowed to view this employee"}, status=403)

        # Totals & level
        total_points = employee.get_total_points()
        level = employee.get_competency_level() 
        pos = employee.position
        min_required_level = getattr(pos, "min_required_level", None)
        level_rank = {"CL0": 0, "CL1": 1, "CL2": 2, "CL3": 3, "CL4": 4}
        below_min_level = False
        try:
            if min_required_level:
                below_min_level = level_rank.get(level, 0) < level_rank.get(min_required_level, 0)
        except Exception:
            below_min_level = False

        # Missing required competencies for this employee (by position+branch)
        req_qs = PositionCompetencyRequirement.objects.filter(required=True)
        if employee.position:
            req_qs = req_qs.filter(position=employee.position)
        else:
            req_qs = req_qs.none()
        if employee.employee_branch:
            req_qs = req_qs.filter(branch=employee.employee_branch)
        else:
            req_qs = req_qs.none()

        missing = []
        for r in req_qs.select_related("competency"):
            has_passed = EmployeeCompetencyRecord.objects.filter(
                employee=employee,
                competency=r.competency,
                status=EmployeeCompetencyRecord.Status.PASSED,
            ).exists()
            if not has_passed:
                missing.append({
                    "id": r.competency_id,
                    "title": r.competency.title if r.competency else None,
                    "reference_number": r.competency.reference_number if r.competency else None,
                })

        # Records & sessions
        records_qs = EmployeeCompetencyRecord.objects.select_related("competency").filter(employee=employee).order_by("-date_completed", "-id")
        sessions_qs = ExamSession.objects.select_related("exam").filter(employee=employee).order_by("-started_at", "-id")

        records_by_status = list(records_qs.values("status").annotate(count=Count("id")))
        sessions_by_status = list(sessions_qs.values("status").annotate(count=Count("id")))

        return Response({
            "user": UserSerializer(employee).data,
            "totals": {
                "total_points": total_points,
                "competency_level": level,
                "min_required_level": min_required_level,
                "below_min_level": below_min_level,
            },
            "missing_competencies": missing,
            "records": EmployeeCompetencyRecordSerializer(records_qs, many=True).data,
            "records_by_status": records_by_status,
            "sessions": ExamSessionSerializer(sessions_qs, many=True).data,
            "sessions_by_status": sessions_by_status,
        })


# ---------------------------------------------------------
# GLOBAL LEVEL THRESHOLDS (GET/UPDATE)
# ---------------------------------------------------------

class LevelThresholdsView(APIView):
    """Admin-configurable global CL1–CL4 minimum points."""
    permission_classes = [AdminOnly]

    def get(self, request):
        obj = LevelThresholdSetting.get_solo()
        return Response(LevelThresholdSettingSerializer(obj).data)

    def post(self, request):
        obj = LevelThresholdSetting.get_solo()
        serializer = LevelThresholdSettingSerializer(instance=obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # Validate monotonicity
        data = serializer.validated_data
        cl1 = data.get("cl1_min_points", obj.cl1_min_points)
        cl2 = data.get("cl2_min_points", obj.cl2_min_points)
        cl3 = data.get("cl3_min_points", obj.cl3_min_points)
        cl4 = data.get("cl4_min_points", obj.cl4_min_points)
        if cl1 < 0 or cl2 < 0 or cl3 < 0 or cl4 < 0:
            return Response({"error": "Points must be non-negative"}, status=400)
        if not (cl1 <= cl2 <= cl3 <= cl4):
            return Response({"error": "Ensure CL1 ≤ CL2 ≤ CL3 ≤ CL4"}, status=400)

        serializer.save()
        return Response(serializer.data)

# ---------------------------------------------------------
# EMPLOYEE DASHBOARD (READ-ONLY API)
# ---------------------------------------------------------

class EmployeeDashboardAPIView(APIView):
    """Lightweight feed of the employee's assigned competencies + active exam."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        position_id = getattr(user, 'position_id', None)
        branch_id = getattr(user, 'employee_branch_id', None)
        reqs = PositionCompetencyRequirement.objects.filter(
            position_id=position_id,
            branch_id=branch_id,
        ).select_related('competency')

        data = []
        for r in reqs:
            comp = r.competency
            if not comp:
                continue
            exam = ExamTemplate.objects.filter(competency=comp, is_active=True).first()
            data.append({
                'competency': CompetencySerializer(comp).data,
                'exam': ExamTemplateSerializer(exam).data if exam else None,
            })
        return Response(data)

# ---------------------------------------------------------
# LEVEL-DEFICIENT REPORT (employees below their position's min_required_level)
# ---------------------------------------------------------

class LevelDeficientReportView(APIView):
    """
    List employees whose current competency level is below the level required
    by their position (Position.min_required_level).

    Returns each as { employee_id, username, employee_number, position, branch,
    current_level, required_level, total_points, required_points, points_short }.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_admin() or user.is_manager()):
            return Response({'error': 'Not allowed'}, status=403)

        branch_id = request.query_params.get('branch')
        position_id = request.query_params.get('position')

        emp_qs = User.objects.filter(role=User.Roles.EMPLOYEE).select_related('position', 'employee_branch')
        if user.is_manager():
            emp_qs = emp_qs.filter(employee_branch__in=user.managed_branches_qs())
        if branch_id:
            emp_qs = emp_qs.filter(employee_branch_id=branch_id)
        if position_id:
            emp_qs = emp_qs.filter(position_id=position_id)

        rank = {'CL0': 0, 'CL1': 1, 'CL2': 2, 'CL3': 3, 'CL4': 4}
        results = []
        for emp in emp_qs:
            pos = emp.position
            if not pos or not pos.min_required_level:
                continue
            current_level = emp.get_competency_level()
            if rank.get(current_level, 0) >= rank.get(pos.min_required_level, 0):
                continue  # already meets the bar
            thresholds = emp.get_competency_level_thresholds()
            total = emp.get_total_points()
            required_pts = thresholds.get(pos.min_required_level, 0)
            results.append({
                'employee_id': emp.id,
                'username': emp.username,
                'employee_number': emp.employee_number,
                'position': pos.name,
                'branch': emp.employee_branch.name if emp.employee_branch else None,
                'current_level': current_level,
                'required_level': pos.min_required_level,
                'total_points': total,
                'required_points': required_pts,
                'points_short': max(0, required_pts - total),
            })
        # Most deficient first
        results.sort(key=lambda r: -r['points_short'])
        return Response({'results': results, 'count': len(results)})
