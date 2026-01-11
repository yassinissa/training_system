from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from django.utils import timezone
from training.models import (
    Competency,
    PositionCompetencyRequirement,
    EmployeeCompetencyRecord,
    ExamTemplate,
    Question,
    QuestionChoice,
    ExamSession,
    ExamAnswer,
)

from training.serializers import (
    CompetencySerializer,
    PositionCompetencyRequirementSerializer,
    EmployeeCompetencyRecordSerializer,
    ExamTemplateSerializer,
    QuestionSerializer,
    QuestionChoiceSerializer,
    ExamSessionSerializer,
    ExamSessionStartSerializer,
    SubmitExamSerializer,
    PublishRequirementsSerializer,
)
from training.permissions import CanManageModules, CanManageExams, CanManageQuestions
from accounts.models import User
from rest_framework import serializers
from django.db.models import Count
from accounts.models import Position


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
            branches = list(user.manager_branches.all())
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
            qs = qs.filter(branch__in=user.manager_branches.all())
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


# ---------------------------------------------------------
# EMPLOYEE COMPETENCY PROGRESS
# ---------------------------------------------------------

class MyCompetenciesView(generics.ListAPIView):
    serializer_class = EmployeeCompetencyRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return EmployeeCompetencyRecord.objects.filter(employee=self.request.user)


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
        qs = ExamTemplate.objects.filter(is_active=True)
        user = self.request.user
        branch_param = self.request.query_params.get("branch")
        competency_param = self.request.query_params.get("competency")
        position_param = self.request.query_params.get("position")

        if user.is_admin() or user.is_manager():
            if competency_param:
                qs = qs.filter(competency_id=competency_param)
            if user.is_manager():
                from training.models import PositionCompetencyRequirement
                allowed = PositionCompetencyRequirement.objects.filter(
                    branch__in=user.manager_branches.all() if not branch_param else [branch_param]
                )
                if position_param:
                    allowed = allowed.filter(position_id=position_param)
                qs = qs.filter(competency_id__in=allowed.values_list("competency_id", flat=True))
            return qs

        # Employees: only exams for their position/branch via requirements
        from training.models import PositionCompetencyRequirement
        competency_ids = PositionCompetencyRequirement.objects.filter(
            position=user.position,
            branch=user.employee_branch,
        ).values_list("competency_id", flat=True)
        return qs.filter(competency_id__in=competency_ids)


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

class StartExamSessionView(generics.CreateAPIView):
    queryset = ExamSession.objects.all()
    serializer_class = ExamSessionStartSerializer
    permission_classes = [permissions.IsAuthenticated]


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
            qs = qs.filter(employee__employee_branch__in=user.manager_branches.all())
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
            return Response({"error": "Invalid session"}, status=400)

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

        # Update session state
        session.score = total_score
        session.max_score = max_score
        session.status = ExamSession.Status.SUBMITTED
        session.submitted_at = timezone.now()
        session.save()

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
            if not employee_branch or employee_branch not in user.manager_branches.all():
                return Response({"error": "Not allowed to grade this session"}, status=403)

        if session.status != ExamSession.Status.SUBMITTED:
            return Response({"error": "Exam must be submitted first"}, status=400)

        # Optional override of status by manager; else threshold pass/fail
        override_status = request.data.get("status")  # PASSED/FAILED

        # Recompute final totals from answers
        session.calculate_final_score()

        exam = session.exam
        employee = session.employee
        competency = exam.competency

        pct = (session.score / session.max_score * 100.0) if session.max_score else 0.0
        passed = pct >= 90.0 if not override_status else (override_status == "PASSED")

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
            if not employee_branch or employee_branch not in user.manager_branches.all():
                return Response({"error": "Not allowed to grade this answer"}, status=403)

        ans.points_awarded = float(points)
        ans.manager_comment = comment
        ans.save()

        return Response({"message": "Answer graded"})


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
            qs = qs.filter(employee__employee_branch__in=user.manager_branches.all())
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
        if user.is_manager() and not user.manager_branches.filter(id=branch_id).exists():
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
# ---------------------------------------------------------

class DashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.is_admin() or user.is_manager():
            scope_filter = {}
            if user.is_manager():
                scope_filter = {"employee__employee_branch__in": user.manager_branches.all()}
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
            req_qs = req_qs.filter(branch__in=user.manager_branches.all())
        if branch_id:
            req_qs = req_qs.filter(branch_id=branch_id)
        if position_id:
            req_qs = req_qs.filter(position_id=position_id)

        # Employees in scope
        emp_qs = User.objects.filter(role=User.Roles.EMPLOYEE)
        if user.is_manager():
            emp_qs = emp_qs.filter(employee_branch__in=user.manager_branches.all())
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
