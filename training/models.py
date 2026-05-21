from django.db import models
from django.utils import timezone
from django.conf import settings


# ---------------------------------------------------------
# ENUMS
# ---------------------------------------------------------

class Frequency(models.TextChoices):
    ONE_TIME = "ONE_TIME", "One time"
    YEARLY = "YEARLY", "Yearly"
    NEW_HIRE = "NEW_HIRE", "New hire"
    PROMOTION = "PROMOTION", "Promotion"
    OTHER = "OTHER", "Other"


class CompetencyLevel(models.TextChoices):
    CL0 = "CL0", "None"
    CL1 = "CL1", "Awareness"
    CL2 = "CL2", "Knowledge"
    CL3 = "CL3", "Skill"
    CL4 = "CL4", "Master"


# ---------------------------------------------------------
# COMPETENCY (Replaces TrainingModule)
# ---------------------------------------------------------

class Competency(models.Model):
    reference_number = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=255)

    # From Excel: 2 Hours, 4 Hours, etc.
    duration = models.CharField(max_length=50, blank=True, null=True)

    # New Hire, Yearly, Trainers, Manager, KP
    frequency = models.CharField(
        max_length=20,
        choices=Frequency.choices,
        default=Frequency.ONE_TIME,
    )

    # Priority points (1, 2, 3, 7, etc.)
    priority_points = models.PositiveIntegerField(default=0)

    # FOH, HOH, Training, General
    competency_area = models.CharField(max_length=100, blank=True, null=True)

    # Brand (LUMA, BL, LEVANT, etc.)
    brand = models.CharField(max_length=50, blank=True, null=True)

    # Does this competency require an exam?
    requires_exam = models.BooleanField(default=False)

    # Optional content
    description = models.TextField(blank=True)
    content = models.TextField(blank=True)
    pdf_file = models.FileField(upload_to="competencies/pdfs/", blank=True, null=True)
    image = models.ImageField(upload_to="competencies/images/", blank=True, null=True)
    external_link = models.URLField(blank=True, null=True)

    # Exam templates link back to this via ExamTemplate.competency

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="competencies_created"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.reference_number} - {self.title}"


# ---------------------------------------------------------
# POSITION → COMPETENCY REQUIREMENTS
# ---------------------------------------------------------

class PositionCompetencyRequirement(models.Model):
    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="position_requirements",
    )
    position = models.ForeignKey(
        "accounts.Position",
        on_delete=models.CASCADE,
        related_name="competency_requirements"
    )

    competency = models.ForeignKey(
        "training.Competency",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="position_requirements"
    )



    # New Hire, Yearly, etc. (override if needed)
    frequency = models.CharField(
        max_length=20,
        choices=Frequency.choices,
        blank=True,
        null=True
    )

    # Priority points (1, 2, 3, 7)
    priority_points = models.PositiveIntegerField(default=0)

    required = models.BooleanField(default=True)

    class Meta:
        unique_together = ("position", "competency", "branch")

    def __str__(self):
        position_name = getattr(self.position, "name", str(self.position))
        competency_title = getattr(self.competency, "title", "-") if self.competency else "-"
        return f"{position_name} → {competency_title}"


# ---------------------------------------------------------
# EMPLOYEE-SPECIFIC REQUIREMENTS (additional to position)
# ---------------------------------------------------------

class EmployeeCompetencyRequirement(models.Model):
    """
    Assign competencies directly to an employee (by name/employee number),
    without applying to an entire position. Used for promotions or targeted training.
    """
    employee = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="individual_requirements",
    )

    competency = models.ForeignKey(
        "training.Competency",
        on_delete=models.CASCADE,
        related_name="employee_requirements",
    )

    # Optional branch scope (if set, applies only when employee is in this branch)
    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="employee_requirements",
    )

    frequency = models.CharField(
        max_length=20,
        choices=Frequency.choices,
        blank=True,
        null=True,
    )

    priority_points = models.PositiveIntegerField(default=0)
    required = models.BooleanField(default=True)

    class Meta:
        unique_together = ("employee", "competency", "branch")

    def __str__(self):
        return f"{self.employee.username} → {getattr(self.competency, 'title', '-') }"


# ---------------------------------------------------------
# EXAM TEMPLATE
# ---------------------------------------------------------

class ExamTemplate(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    competency = models.ForeignKey(
        "training.Competency",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="exam_templates"   # ← IMPORTANT
    )

    position = models.CharField(max_length=100, blank=True, null=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="exams_created"
    )

    time_limit_seconds = models.PositiveIntegerField(default=600)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

# ---------------------------------------------------------
# QUESTIONS
# ---------------------------------------------------------

class Question(models.Model):

    class QuestionType(models.TextChoices):
        MCQ_SINGLE = "MCQ_SINGLE", "Multiple Choice (Single Answer)"
        MCQ_MULTI = "MCQ_MULTI", "Multiple Choice (Multiple Answers)"
        TRUE_FALSE = "TRUE_FALSE", "True / False"
        SHORT_TEXT = "SHORT_TEXT", "Short Text"
        LONG_TEXT = "LONG_TEXT", "Long Text"

    exam = models.ForeignKey(
        ExamTemplate,
        on_delete=models.CASCADE,
        related_name="questions"
    )

    text = models.TextField()
    type = models.CharField(
        max_length=20,
        choices=QuestionType.choices,
        default=QuestionType.MCQ_SINGLE,
    )

    order = models.PositiveIntegerField(default=1)
    max_points = models.FloatField(default=1)

    def __str__(self):
        return f"Q{self.order}: {self.text[:40]}"


# ---------------------------------------------------------
# CHOICES
# ---------------------------------------------------------

class QuestionChoice(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="choices"
    )
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.text} ({'correct' if self.is_correct else 'wrong'})"


# ---------------------------------------------------------
# EXAM SESSION
# ---------------------------------------------------------

class ExamSession(models.Model):

    class Status(models.TextChoices):
        IN_PROGRESS = "IN_PROGRESS"
        SUBMITTED = "SUBMITTED"
        GRADED = "GRADED"
        EXPIRED = "EXPIRED"

    exam = models.ForeignKey(
        ExamTemplate,
        on_delete=models.CASCADE,
        related_name="sessions"
    )

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="exam_sessions"
    )

    started_at = models.DateTimeField(default=timezone.now)
    submitted_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.IN_PROGRESS
    )

    score = models.FloatField(null=True, blank=True)
    max_score = models.FloatField(null=True, blank=True)

    # When a manager allows a failed exam to be retaken, the original failed
    # session is preserved as history and `retake_allowed` is flipped to True.
    # The fresh attempt's `parent_session` then points back to that original
    # failed session so we can show the retake history chain.
    retake_allowed = models.BooleanField(default=False)
    parent_session = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="retakes",
    )

    def __str__(self):
        return f"{self.employee.username} - {self.exam.title}"

    # Auto-grade MCQ + True/False
    def auto_grade(self):
        total = 0
        max_total = 0

        for answer in self.answers.all():
            question = answer.question
            max_total += question.max_points

            if answer.is_auto_graded():
                auto_points = answer.auto_score()
                answer.points_awarded = auto_points
                answer.save()
                total += auto_points

        self.score = total
        self.max_score = max_total
        self.status = ExamSession.Status.SUBMITTED
        self.submitted_at = timezone.now()
        self.save()

    # Final score after manual grading
    def calculate_final_score(self):
        total = 0
        max_total = 0

        for answer in self.answers.all():
            question = answer.question
            max_total += question.max_points
            total += answer.points_awarded or 0

        self.score = total
        self.max_score = max_total
        self.status = ExamSession.Status.GRADED
        self.save()

    def is_expired(self):
        end_time = self.started_at + timezone.timedelta(seconds=self.exam.time_limit_seconds)
        return timezone.now() > end_time


# ---------------------------------------------------------
# EXAM ANSWERS
# ---------------------------------------------------------

class ExamAnswer(models.Model):
    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="answers"
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="answers"
    )

    selected_choices = models.ManyToManyField(
        QuestionChoice,
        blank=True,
        related_name="answers"
    )

    text_answer = models.TextField(blank=True)

    points_awarded = models.FloatField(null=True, blank=True)
    manager_comment = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Answer (Q{self.question.id}) by {self.session.employee.username}"

    def auto_score(self):
        question = self.question
        max_points = question.max_points

        if question.type == Question.QuestionType.MCQ_SINGLE:
            correct = question.choices.filter(is_correct=True).first()
            return max_points if correct in self.selected_choices.all() else 0

        # MCQ_MULTI now requires manual grading (no auto score)
        if question.type == Question.QuestionType.MCQ_MULTI:
            return None

        if question.type == Question.QuestionType.TRUE_FALSE:
            correct = question.choices.filter(is_correct=True).first()
            return max_points if correct in self.selected_choices.all() else 0

        return None

    def is_auto_graded(self):
        return self.question.type in [
            Question.QuestionType.MCQ_SINGLE,
            Question.QuestionType.TRUE_FALSE,
        ]


# ---------------------------------------------------------
# EMPLOYEE COMPETENCY RECORD
# ---------------------------------------------------------

class EmployeeCompetencyRecord(models.Model):

    class Status(models.TextChoices):
        NOT_STARTED = "NOT_STARTED", "Not started"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        PASSED = "PASSED", "Passed"
        FAILED = "FAILED", "Failed"
        RETRAIN = "RETRAIN", "Retrain"

    employee = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="competency_records"
    )

    competency = models.ForeignKey(
        Competency,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="employee_records"
    )

    position_requirement = models.ForeignKey(
        PositionCompetencyRequirement,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NOT_STARTED
    )

    score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    points_earned = models.IntegerField(default=0)

    date_completed = models.DateField(null=True, blank=True)
    week = models.CharField(max_length=10, blank=True, null=True)
    period = models.CharField(max_length=10, blank=True, null=True)
    quarter = models.CharField(max_length=10, blank=True, null=True)

    attempts_count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("employee", "competency")

    def __str__(self):
        return f"{self.employee.username} → {self.competency.title}"


# ---------------------------------------------------------
# SAVED VIEWS / EXPORT PRESETS
# ---------------------------------------------------------

class SavedView(models.Model):
    EXPORT_TYPES = (
        ("compliance", "Compliance"),
        ("sessions", "Sessions"),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_views",
    )
    name = models.CharField(max_length=255)
    export_type = models.CharField(max_length=32, choices=EXPORT_TYPES, default="compliance")
    filters_json = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.export_type})"


# ---------------------------------------------------------
# SCHEDULER SETTINGS (stub configuration)
# ---------------------------------------------------------

class SchedulerSetting(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="scheduler_settings",
    )
    enable_auto_reminders = models.BooleanField(default=False)
    enable_scheduled_reports = models.BooleanField(default=False)
    report_frequency = models.CharField(max_length=20, default="weekly")  # daily/weekly/monthly
    last_run = models.DateTimeField(blank=True, null=True)
    last_result = models.TextField(blank=True)

    def __str__(self):
        return f"Scheduler for {self.owner}" 


# ---------------------------------------------------------
# GLOBAL LEVEL THRESHOLDS (CL1–CL4 MIN POINTS)
# ---------------------------------------------------------

class LevelThresholdSetting(models.Model):
    """
    Stores global point thresholds for competency levels.
    Not position-specific. Admins set CL1–CL4 minimum points here.
    """

    cl1_min_points = models.IntegerField(default=0)
    cl2_min_points = models.IntegerField(default=0)
    cl3_min_points = models.IntegerField(default=0)
    cl4_min_points = models.IntegerField(default=0)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return "Global Level Thresholds"

    @classmethod
    def get_solo(cls):
        obj = cls.objects.first()
        if obj is None:
            obj = cls.objects.create(
                cl1_min_points=0,
                cl2_min_points=0,
                cl3_min_points=0,
                cl4_min_points=0,
            )
        return obj
