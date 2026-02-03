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
    employee = UserSerializer(read_only=True)
    competency = CompetencySerializer(read_only=True)
    branch = BranchSerializer(read_only=True)

    employee_id = serializers.IntegerField(write_only=True)
    competency_id = serializers.IntegerField(write_only=True)
    branch_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = EmployeeCompetencyRequirement
        fields = [
            "id",
            "employee",
            "competency",
            "branch",
            "frequency",
            "priority_points",
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


class ExamTemplateSerializer(serializers.ModelSerializer):
    competency = CompetencySerializer(read_only=True)
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

    def get_questions(self, obj):
        qs = obj.questions.all().order_by('order', 'id')
        data = QuestionSerializer(qs, many=True).data
        # DEBUG: Print the serialized questions to the console/log
        import sys
        print(f"[DEBUG] Serialized questions for exam {obj.id}: {data}", file=sys.stderr)
        return data
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
        branch = getattr(getattr(obj.employee, "employee_branch", None), "branch", None)
        # If employee_branch is a relation, return id/name; else return value
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
        print(f"[DEBUG] validate_exam_id: user={user}, value={value}")
        try:
            exam = ExamTemplate.objects.get(id=value, is_active=True)
            print(f"[DEBUG] Exam found: {exam}")
        except ExamTemplate.DoesNotExist:
            print("[DEBUG] ExamTemplate.DoesNotExist")
            raise serializers.ValidationError("Invalid or inactive exam.")

        # Employees can only start exams posted for their position and branch
        if user and user.is_authenticated and hasattr(user, "is_employee") and user.is_employee():
            from training.models import PositionCompetencyRequirement
            allowed = PositionCompetencyRequirement.objects.filter(
                position=user.position,
                competency=exam.competency,
                branch=user.employee_branch,
            ).exists()
            print(f"[DEBUG] PositionCompetencyRequirement allowed={allowed}")
            if not allowed:
                print("[DEBUG] Not allowed to take this exam.")
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
        total = user.get_total_points()

        # Use global thresholds
        thresholds = LevelThresholdSetting.get_solo()
        cl1 = thresholds.cl1_min_points or 0
        cl2 = thresholds.cl2_min_points or 0
        cl3 = thresholds.cl3_min_points or 0
        cl4 = thresholds.cl4_min_points or 0

        if total < cl1:
            return cl1
        if total < cl2:
            return cl2
        if total < cl3:
            return cl3
        if total < cl4:
            return cl4

        return None  # Already at CL4

    def get_points_needed(self, obj):
        next_level = self.get_next_level_points(obj)
        if next_level is None:
            return 0
        return max(0, next_level - obj.employee.get_total_points())
