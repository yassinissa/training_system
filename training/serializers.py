from rest_framework import serializers
from training.models import (
    Competency,
    PositionCompetencyRequirement,
    EmployeeCompetencyRecord,
    ExamTemplate,
    Question,
    QuestionChoice,
    ExamSession,
    ExamAnswer,
    LevelThresholdSetting,
    EmployeeCompetencyRequirement,
)
from accounts.serializers import PositionSerializer, UserSerializer
from branches.serializers import BranchSerializer


# ---------------------------------------------------------
# COMPETENCY SERIALIZER
# ---------------------------------------------------------

class CompetencySerializer(serializers.ModelSerializer):
    remove_image = serializers.BooleanField(write_only=True, required=False)
    remove_pdf_file = serializers.BooleanField(write_only=True, required=False)

    def create(self, validated_data):
        # These flags only make sense for updates; strip them so the
        # default model create() doesn't get unknown kwargs.
        validated_data.pop('remove_image', None)
        validated_data.pop('remove_pdf_file', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Handle remove_image/remove_pdf_file flags
        remove_image = validated_data.pop('remove_image', False)
        remove_pdf = validated_data.pop('remove_pdf_file', False)
        if remove_image in [True, 'true', 'True', 1, '1']:
            if instance.image:
                instance.image.delete(save=False)
            validated_data['image'] = None
        if remove_pdf in [True, 'true', 'True', 1, '1']:
            if instance.pdf_file:
                instance.pdf_file.delete(save=False)
            validated_data['pdf_file'] = None
        for file_field in ["image", "pdf_file"]:
            if file_field in validated_data and validated_data[file_field] == "":
                validated_data[file_field] = None
        return super().update(instance, validated_data)

    def partial_update(self, instance, validated_data):
        # Same logic for PATCH/partial_update
        for file_field in ["image", "pdf_file"]:
            if file_field in validated_data and validated_data[file_field] == "":
                validated_data[file_field] = None
        return super().update(instance, validated_data)
    class Meta:
        model = Competency
        fields = [
            "id",
            "reference_number",
            "title",
            "duration",
            "frequency",
            "priority_points",
            "competency_area",
            "brand",
            "requires_exam",
            "description",
            "content",
            "pdf_file",
            "image",
            "external_link",
            "created_by",
            "created_at",
            "remove_image",
            "remove_pdf_file",
        ]
        read_only_fields = ["created_by", "created_at"]


# ---------------------------------------------------------
# POSITION → COMPETENCY REQUIREMENT
# ---------------------------------------------------------

class PositionCompetencyRequirementSerializer(serializers.ModelSerializer):
    def validate_priority_points(self, value):
        if value is None or value < 1:
            raise serializers.ValidationError("Priority points must be a positive integer.")
        return value
    position = PositionSerializer(read_only=True)
    competency = CompetencySerializer(read_only=True)
    branch = BranchSerializer(read_only=True)

    position_id = serializers.IntegerField(write_only=True)
    competency_id = serializers.IntegerField(write_only=True)
    branch_id = serializers.IntegerField(write_only=True, required=False)

    requirement_priority_points = serializers.IntegerField(source="priority_points", read_only=True, help_text="Points for this requirement (used for employee progress)")
    competency_priority_points = serializers.IntegerField(source="competency.priority_points", read_only=True, help_text="Default points for the competency (used for weighting, not employee progress)")

    class Meta:
        model = PositionCompetencyRequirement
        fields = [
            "id",
            "position",
            "competency",
            "branch",
            "frequency",
            "requirement_priority_points",
            "competency_priority_points",
            "required",
            "position_id",
            "competency_id",
            "branch_id",
        ]

    def create(self, validated_data):
        position_id = validated_data.pop("position_id")
        competency_id = validated_data.pop("competency_id")
        branch_id = validated_data.pop("branch_id", None)

        # Prevent duplicate creation
        if PositionCompetencyRequirement.objects.filter(
            position_id=position_id,
            competency_id=competency_id,
            branch_id=branch_id
        ).exists():
            raise serializers.ValidationError({
                "non_field_errors": [
                    "A requirement for this position, competency, and branch already exists."]
            })

        return PositionCompetencyRequirement.objects.create(
            position_id=position_id,
            competency_id=competency_id,
            branch_id=branch_id,
            **validated_data
        )

    def update(self, instance, validated_data):
        # Handle write-only IDs for updates
        position_id = validated_data.pop("position_id", None)
        competency_id = validated_data.pop("competency_id", None)
        branch_id = validated_data.pop("branch_id", None)

        if position_id is not None:
            instance.position_id = position_id
        if competency_id is not None:
            instance.competency_id = competency_id
        if branch_id is not None:
            instance.branch_id = branch_id

        # Update other fields
        for field in ["frequency", "priority_points", "required"]:
            if field in validated_data:
                setattr(instance, field, validated_data[field])

        instance.save()
        return instance


# ---------------------------------------------------------
# EMPLOYEE-SPECIFIC REQUIREMENT SERIALIZER
# ---------------------------------------------------------

class EmployeeCompetencyRequirementSerializer(serializers.ModelSerializer):
    def validate_priority_points(self, value):
        if value is None or value < 1:
            raise serializers.ValidationError("Priority points must be a positive integer.")
        return value
    employee = UserSerializer(read_only=True)
    competency = CompetencySerializer(read_only=True)
    branch = BranchSerializer(read_only=True)

    employee_id = serializers.IntegerField(write_only=True)
    competency_id = serializers.IntegerField(write_only=True)
    branch_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    requirement_priority_points = serializers.IntegerField(source="priority_points", read_only=True, help_text="Points for this requirement (used for employee progress)")
    competency_priority_points = serializers.IntegerField(source="competency.priority_points", read_only=True, help_text="Default points for the competency (used for weighting, not employee progress)")

    class Meta:
        model = EmployeeCompetencyRequirement
        fields = [
            "id",
            "employee",
            "competency",
            "branch",
            "frequency",
            "requirement_priority_points",
            "competency_priority_points",
            "required",
            "employee_id",
            "competency_id",
            "branch_id",
        ]

    def create(self, validated_data):
        employee_id = validated_data.pop("employee_id")
        competency_id = validated_data.pop("competency_id")
        branch_id = validated_data.pop("branch_id", None)
        obj, _ = EmployeeCompetencyRequirement.objects.update_or_create(
            employee_id=employee_id,
            competency_id=competency_id,
            branch_id=branch_id,
            defaults=validated_data,
        )
        return obj


# ---------------------------------------------------------
# EMPLOYEE COMPETENCY RECORD
# ---------------------------------------------------------

class EmployeeCompetencyRecordSerializer(serializers.ModelSerializer):
    employee = UserSerializer(read_only=True)
    competency = CompetencySerializer(read_only=True)

    class Meta:
        model = EmployeeCompetencyRecord
        fields = [
            "id",
            "employee",
            "competency",
            "status",
            "score",
            "points_earned",
            "date_completed",
            "week",
            "period",
            "quarter",
            "attempts_count",
        ]


# ---------------------------------------------------------
# EXAM TEMPLATE
# ---------------------------------------------------------


# ---------------------------------------------------------
# QUESTION + CHOICES
# ---------------------------------------------------------

class QuestionChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionChoice
        fields = ["id", "question", "text", "is_correct"]


class QuestionSerializer(serializers.ModelSerializer):
    choices = QuestionChoiceSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            "id",
            "exam",
            "text",
            "type",
            "order",
            "max_points",
            "choices",
        ]


class _CompetencyRelatedField(serializers.PrimaryKeyRelatedField):
    """Accept a Competency id on write but return the full nested object on read.

    Without this, ExamTemplate.competency was read-only, so managers creating an
    exam ended up with competency_id=NULL - and the new exam then disappeared
    from the manager exam list (which filters by competency).
    """

    def use_pk_only_optimization(self):
        # Without this, DRF would pass a lightweight PKOnlyObject (only
        # exposing .pk) into to_representation(), and CompetencySerializer
        # would crash trying to read title/reference_number/etc.
        return False

    def to_representation(self, value):
        if value is None:
            return None
        return CompetencySerializer(value).data


class ExamTemplateSerializer(serializers.ModelSerializer):
    competency = _CompetencyRelatedField(
        queryset=Competency.objects.all(),
        allow_null=True,
        required=False,
    )
    questions = serializers.SerializerMethodField()

    class Meta:
        model = ExamTemplate
        fields = [
            "id",
            "title",
            "description",
            "competency",
            "position",
            "time_limit_seconds",
            "is_active",
            "created_by",
            "created_at",
            "questions",
        ]
        read_only_fields = ["created_by", "created_at"]

    def get_questions(self, obj):
        qs = obj.questions.all().order_by('order', 'id')
        return QuestionSerializer(qs, many=True).data


# ---------------------------------------------------------
# PUBLISH REQUIREMENTS SERIALIZER
# ---------------------------------------------------------

class PublishRequirementsSerializer(serializers.Serializer):
    branch_id = serializers.IntegerField()
    competency_id = serializers.IntegerField()
    position_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    frequency = serializers.ChoiceField(choices=Competency._meta.get_field("frequency").choices, required=False)
    priority_points = serializers.IntegerField(required=False)
    required = serializers.BooleanField(required=False)


# ---------------------------------------------------------
# GLOBAL LEVEL THRESHOLDS SERIALIZER
# ---------------------------------------------------------

class LevelThresholdSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LevelThresholdSetting
        fields = [
            "id",
            "cl1_min_points",
            "cl2_min_points",
            "cl3_min_points",
            "cl4_min_points",
            "updated_at",
        ]
        read_only_fields = ["updated_at", "id"]


# ---------------------------------------------------------
# EXAM SESSION + ANSWERS
# ---------------------------------------------------------

class ExamAnswerSerializer(serializers.ModelSerializer):
    selected_choices = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=QuestionChoice.objects.all()
    )

    class Meta:
        model = ExamAnswer
        fields = [
            "id",
            "session",
            "question",
            "selected_choices",
            "text_answer",
            "points_awarded",
            "manager_comment",
        ]


class ExamSessionSerializer(serializers.ModelSerializer):
    employee = UserSerializer(read_only=True)
    exam = ExamTemplateSerializer(read_only=True)
    answers = ExamAnswerSerializer(many=True, read_only=True)
 
    class Meta:
        model = ExamSession
        fields = [
            "id",
            "exam",
            "employee",
            "started_at",
            "submitted_at",
            "status",
            "score",
            "max_score",
            "answers",
            "retake_allowed",
            "parent_session",
        ]


class GradingQueueSessionSerializer(serializers.ModelSerializer):
    employee = UserSerializer(read_only=True)
    exam = ExamTemplateSerializer(read_only=True)
    branch = serializers.SerializerMethodField()
    manual_needed = serializers.SerializerMethodField()
    auto_only = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = [
            "id",
            "exam",
            "employee",
            "branch",
            "submitted_at",
            "status",
            "manual_needed",
            "auto_only",
        ]

    def get_branch(self, obj):
        b = getattr(obj.employee, "employee_branch", None)
        if hasattr(b, "id"):
            return {"id": b.id, "name": getattr(b, "name", "")}
        if b:
            return {"id": b, "name": ""}
        return None

    def get_manual_needed(self, obj):
        answers = getattr(obj, "_prefetched_answers", None) or obj.answers.all()
        for ans in answers:
            if not ans.is_auto_graded() and ans.points_awarded is None:
                return True
        return False

    def get_auto_only(self, obj):
        answers = getattr(obj, "_prefetched_answers", None) or obj.answers.all()
        return all(ans.is_auto_graded() for ans in answers)


class ExamAnswerDetailSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)
    selected_choices = QuestionChoiceSerializer(many=True, read_only=True)

    class Meta:
        model = ExamAnswer
        fields = [
            "id",
            "session",
            "question",
            "selected_choices",
            "text_answer",
            "points_awarded",
            "manager_comment",
        ]


class ExamSessionDetailSerializer(serializers.ModelSerializer):
    employee = UserSerializer(read_only=True)
    exam = ExamTemplateSerializer(read_only=True)
    answers = ExamAnswerDetailSerializer(many=True, read_only=True)

    class Meta:
        model = ExamSession
        fields = [
            "id",
            "exam",
            "employee",
            "started_at",
            "submitted_at",
            "status",
            "score",
            "max_score",
            "answers",
            "retake_allowed",
            "parent_session",
        ]


# ---------------------------------------------------------
# START EXAM SESSION SERIALIZER
# ---------------------------------------------------------

class ExamSessionStartSerializer(serializers.ModelSerializer):
    exam_id = serializers.IntegerField(write_only=True)

    exam = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = [
            "id",
            "exam_id",
            "employee",
            "started_at",
            "status",
            "exam",
        ]
        read_only_fields = ["employee", "started_at", "status"]

    def get_exam(self, obj):
        from training.serializers import ExamTemplateSerializer
        return ExamTemplateSerializer(obj.exam).data if obj.exam else None

    def validate_exam_id(self, value):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        try:
            exam = ExamTemplate.objects.get(id=value, is_active=True)
        except ExamTemplate.DoesNotExist:
            raise serializers.ValidationError("Invalid or inactive exam.")

        # Block re-take: if this employee has already submitted or had this
        # exam graded, refuse to start a new session - UNLESS a manager has
        # explicitly flagged a failed attempt with retake_allowed=True (in
        # which case we let them start a fresh attempt; the failed record
        # is preserved as history).
        if user and user.is_authenticated:
            done_sessions = ExamSession.objects.filter(
                exam=exam,
                employee=user,
                status__in=[ExamSession.Status.SUBMITTED, ExamSession.Status.GRADED],
            )
            has_retake_unlock = done_sessions.filter(retake_allowed=True).exists()
            already_done = done_sessions.exists()
            # If there is already a fresh IN_PROGRESS session for this exam,
            # the employee is simply resuming - allow it.
            has_open = ExamSession.objects.filter(
                exam=exam,
                employee=user,
                status=ExamSession.Status.IN_PROGRESS,
            ).exists()
            if already_done and not has_retake_unlock and not has_open:
                raise serializers.ValidationError(
                    "You have already submitted this assessment. You cannot retake it."
                )

        # Employees can only start exams posted for their position and branch
        if user and user.is_authenticated and hasattr(user, "is_employee") and user.is_employee():
            from training.models import PositionCompetencyRequirement
            allowed = PositionCompetencyRequirement.objects.filter(
                position=user.position,
                competency=exam.competency,
                branch=user.employee_branch,
            ).exists()
            if not allowed:
                raise serializers.ValidationError("You are not allowed to take this exam.")

        self._exam = exam
        return value

    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        exam = getattr(self, "_exam", None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        if exam is None:
            raise serializers.ValidationError("Exam not provided or invalid.")
        # Reuse an open session if one already exists for this (exam, employee)
        # pair so the employee can resume rather than accumulating duplicates.
        existing = (
            ExamSession.objects
            .filter(exam=exam, employee=user, status=ExamSession.Status.IN_PROGRESS)
            .order_by('-started_at')
            .first()
        )
        if existing:
            # Mark any earlier in-progress duplicates as expired (cleanup).
            ExamSession.objects.filter(
                exam=exam, employee=user, status=ExamSession.Status.IN_PROGRESS
            ).exclude(pk=existing.pk).update(status=ExamSession.Status.EXPIRED)
            return existing
        return ExamSession.objects.create(exam=exam, employee=user)


# ---------------------------------------------------------
# SUBMIT EXAM SERIALIZER
# ---------------------------------------------------------

class SubmitExamSerializer(serializers.Serializer):
    session_id = serializers.IntegerField()
    answers = serializers.ListField(child=serializers.DictField(), allow_empty=False)
from rest_framework import serializers
from training.models import EmployeeCompetencyRecord


class MyCompetencyRecordSerializer(serializers.ModelSerializer):
    competency_title = serializers.CharField(source="competency.title", read_only=True)
    total_points = serializers.SerializerMethodField()
    competency_level = serializers.SerializerMethodField()
    next_level_points = serializers.SerializerMethodField()
    points_needed = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeCompetencyRecord
        fields = [
            "competency_title",
            "status",
            "score",
            "points_earned",
            "date_completed",
            "week",
            "period",
            "quarter",
            "total_points",
            "competency_level",
            "next_level_points",
            "points_needed",
        ]

    def get_total_points(self, obj):
        return obj.employee.g