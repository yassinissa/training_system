from django.contrib import admin
from .models import (
    Competency,
    PositionCompetencyRequirement,
    EmployeeCompetencyRecord,
    ExamTemplate,
    Question,
    QuestionChoice,
    ExamSession,
    ExamAnswer,
)


# ---------------------------------------------------------
# INLINE CONFIGURATIONS
# ---------------------------------------------------------

class QuestionChoiceInline(admin.TabularInline):
    model = QuestionChoice
    extra = 1


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1


# ---------------------------------------------------------
# COMPETENCY ADMIN
# ---------------------------------------------------------

@admin.register(Competency)
class CompetencyAdmin(admin.ModelAdmin):
    list_display = (
        "reference_number",
        "title",
        "competency_area",
        "frequency",
        "priority_points",
        "brand",
        "requires_exam",
        "created_by",
        "created_at",
    )
    search_fields = ("reference_number", "title", "description")
    list_filter = ("competency_area", "frequency", "brand", "requires_exam", "created_by", "created_at")


# ---------------------------------------------------------
# POSITION → COMPETENCY REQUIREMENT ADMIN
# ---------------------------------------------------------

@admin.register(PositionCompetencyRequirement)
class PositionCompetencyRequirementAdmin(admin.ModelAdmin):
    list_display = (
        "position",
        "competency",
        "frequency",
        "priority_points",
        "required",
        "branch",
    )
    list_filter = ("position", "frequency", "required", "branch")
    search_fields = ("position__name", "competency__title")
    raw_id_fields = ("position", "competency", "branch")


# ---------------------------------------------------------
# EMPLOYEE COMPETENCY RECORD ADMIN
# ---------------------------------------------------------

@admin.register(EmployeeCompetencyRecord)
class EmployeeCompetencyRecordAdmin(admin.ModelAdmin):
    list_display = (
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
    )
    list_filter = ("status", "competency", "employee", "employee__employee_branch")
    search_fields = ("employee__username", "competency__title")
    date_hierarchy = "date_completed"


# ---------------------------------------------------------
# EXAM TEMPLATE ADMIN
# ---------------------------------------------------------

@admin.register(ExamTemplate)
class ExamTemplateAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "competency",
        "position",
        "time_limit_seconds",
        "is_active",
        "created_by",
        "created_at",
    )
    list_filter = ("competency", "position", "is_active", "created_by", "created_at")
    search_fields = ("title", "description", "competency__title", "competency__reference_number")
    inlines = [QuestionInline]


# ---------------------------------------------------------
# QUESTION ADMIN
# ---------------------------------------------------------

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("text", "type", "order", "exam")
    list_filter = ("type", "exam")
    search_fields = ("text",)
    inlines = [QuestionChoiceInline]


# ---------------------------------------------------------
# EXAM SESSION ADMIN
# ---------------------------------------------------------

@admin.register(ExamSession)
class ExamSessionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "employee",
        "exam",
        "status",
        "score",
        "started_at",
        "submitted_at",
    )
    list_filter = ("status", "exam")
    search_fields = ("employee__username",)
    readonly_fields = ("started_at", "submitted_at", "score", "max_score")

    actions = ("action_auto_grade", "action_recalculate_and_mark_graded")

    def action_auto_grade(self, request, queryset):
        count = 0
        for session in queryset:
            session.auto_grade()
            count += 1
        self.message_user(request, f"Auto-graded {count} session(s).")
    action_auto_grade.short_description = "Auto-grade selected sessions"

    def action_recalculate_and_mark_graded(self, request, queryset):
        count = 0
        for session in queryset:
            session.calculate_final_score()
            count += 1
        self.message_user(request, f"Recalculated and marked graded for {count} session(s).")
    action_recalculate_and_mark_graded.short_description = "Recalculate score and mark as graded"


# ---------------------------------------------------------
# EXAM ANSWER ADMIN
# ---------------------------------------------------------

@admin.register(ExamAnswer)
class ExamAnswerAdmin(admin.ModelAdmin):
    list_display = ("session", "question", "points_awarded")
    list_filter = ("session", "question")
    search_fields = ("question__text",)
    raw_id_fields = ("session", "question")
    filter_horizontal = ("selected_choices",)
