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
)
from accounts.serializers import PositionSerializer, UserSerializer
from branches.serializers import BranchSerializer


# ---------------------------------------------------------
# COMPETENCY SERIALIZER
# ---------------------------------------------------------

class CompetencySerializer(serializers.ModelSerializer):
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
        ]
        read_only_fields = ["created_by", "created_at"]


# ---------------------------------------------------------
# POSITION → COMPETENCY REQUIREMENT
# ---------------------------------------------------------

class PositionCompetencyRequirementSerializer(serializers.ModelSerializer):
    position = PositionSerializer(read_only=True)
    competency = CompetencySerializer(read_only=True)
    branch = BranchSerializer(read_only=True)

    position_id = serializers.IntegerField(write_only=True)
    competency_id = serializers.IntegerField(write_only=True)
    branch_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = PositionCompetencyRequirement
        fields = [
            "id",
            "position",
            "competency",
            "branch",
            "frequency",
            "priority_points",
            "required",
            "position_id",
            "competency_id",
            "branch_id",
        ]

    def create(self, validated_data):
        position_id = validated_data.pop("position_id")
        competency_id = validated_data.pop("competency_id")
        branch_id = validated_data.pop("branch_id", None)

        return PositionCompetencyRequirement.objects.create(
            position_id=position_id,
            competency_id=competency_id,
            branch_id=branch_id,
            **validated_data
        )


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

class ExamTemplateSerializer(serializers.ModelSerializer):
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
        ]
        read_only_fields = ["created_by", "created_at"]


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
        ]


# ---------------------------------------------------------
# START EXAM SESSION SERIALIZER
# ---------------------------------------------------------

class ExamSessionStartSerializer(serializers.ModelSerializer):
    exam_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = ExamSession
        fields = [
            "id",
            "exam_id",
            "employee",
            "started_at",
            "status",
        ]
        read_only_fields = ["employee", "started_at", "status"]

    def validate_exam_id(self, value):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        try:
            exam = ExamTemplate.objects.get(id=value, is_active=True)
        except ExamTemplate.DoesNotExist:
            raise serializers.ValidationError("Invalid or inactive exam.")

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
        return obj.employee.get_total_points()

    def get_competency_level(self, obj):
        return obj.employee.get_competency_level()

    def get_next_level_points(self, obj):
        user = obj.employee
        pos = user.position
        total = user.get_total_points()

        if not pos:
            return None

        # Determine next threshold
        if total < pos.cl1_min_points:
            return pos.cl1_min_points
        if total < pos.cl2_min_points:
            return pos.cl2_min_points
        if total < pos.cl3_min_points:
            return pos.cl3_min_points
        if total < pos.cl4_min_points:
            return pos.cl4_min_points

        return None  # Already at CL4

    def get_points_needed(self, obj):
        next_level = self.get_next_level_points(obj)
        if next_level is None:
            return 0
        return max(0, next_level - obj.employee.get_total_points())
