from django.contrib import admin
from django import forms
from .models import User, Position, Notification
from training.models import PositionCompetencyRequirement
from django.contrib.auth.hashers import identify_hasher
admin.site.site_header = "Green Hills Training"
admin.site.site_title = "Green Hills Admin"
admin.site.index_title = "Welcome to the Green Hills Training System"

class UserAdminForm(forms.ModelForm):
    class Meta:
        model = User
        fields = "__all__"

    def clean(self):
        cleaned_data = super().clean()
        role = cleaned_data.get("role")

        # Managers + Employees need employee_number
        if role in [User.Roles.MANAGER, User.Roles.EMPLOYEE] and not cleaned_data.get("employee_number"):
            raise forms.ValidationError("Employee number is required for managers and employees.")

        # Manager rules
        if role == User.Roles.MANAGER:
            if not cleaned_data.get("position"):
                raise forms.ValidationError("Managers must have a position.")
            branches = cleaned_data.get("manager_branches")
            # handle both QuerySet and list-like
            has_any = False
            if branches is None:
                has_any = False
            elif hasattr(branches, 'count'):
                has_any = branches.count() > 0
            else:
                try:
                    has_any = len(branches) > 0
                except Exception:
                    has_any = False
            if not has_any:
                raise forms.ValidationError("Managers must be assigned to at least one branch.")

        # Employee rules
        if role == User.Roles.EMPLOYEE:
            if not cleaned_data.get("position"):
                raise forms.ValidationError("Employees must have a position.")
            if not cleaned_data.get("employee_branch"):
                raise forms.ValidationError("Employees must have an assigned branch.")

        return cleaned_data




class UserAdmin(admin.ModelAdmin):

    class Media:
        js = ["admin/js/user_role_fields.js"]
    form = UserAdminForm
    list_display = [
        "username",
        "role",
        "employee_number",
        "employee_branch",
        "position",
        "total_points",
        "current_level",
    ]
    ordering = ["username"]

    def save_model(self, request, obj, form, change):
        # Ensure passwords entered in the admin UI are hashed
        if form is not None and "password" in form.changed_data:
            raw = form.cleaned_data.get("password")
            if raw:
                try:
                    # If this succeeds, it's already a valid hashed password
                    identify_hasher(raw)
                except Exception:
                    # Otherwise, treat it as plaintext and hash it
                    obj.set_password(raw)
        super().save_model(request, obj, form, change)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Annotate with total points for sorting
        from django.db.models import Sum, Case, When, IntegerField
        from training.models import EmployeeCompetencyRecord
        return qs.annotate(
            _total_points=Sum(
                Case(
                    When(
                        competency_records__status="PASSED",
                        then="competency_records__points_earned"
                    ),
                    default=0,
                    output_field=IntegerField(),
                )
            )
        )

    def total_points(self, obj):
        # Use annotated value if available for sorting
        return getattr(obj, "_total_points", None) or obj.get_total_points()
    total_points.admin_order_field = "_total_points"
    total_points.short_description = "Total Points"

    def current_level(self, obj):
        return obj.get_competency_level()
    current_level.short_description = "Current Level"

class CurrentLevelListFilter(admin.SimpleListFilter):
    title = 'Current Level'
    parameter_name = 'current_level'

    def lookups(self, request, model_admin):
        from training.models import CompetencyLevel
        return [
            (level, label)
            for level, label in CompetencyLevel.choices
        ]

    def queryset(self, request, queryset):
        value = self.value()
        if value:
            # Filter users by calculated level
            ids = [u.id for u in queryset if u.get_competency_level() == value]
            return queryset.filter(id__in=ids)
        return queryset



UserAdmin.list_filter = ["role", "employee_branch", CurrentLevelListFilter]

def save_model(self, request, obj, form, change):
    # Ensure passwords entered in the admin UI are hashed
    if form is not None and "password" in form.changed_data:
        raw = form.cleaned_data.get("password")
        if raw:
            try:
                # If this succeeds, it's already a valid hashed password
                identify_hasher(raw)
            except Exception:
                # Otherwise, treat it as plaintext and hash it
                obj.set_password(raw)
    super(UserAdmin, self).save_model(request, obj, form, change)

def get_fieldsets(self, request, obj=None):
    # ADD user: obj is None → show all relevant fields
    if obj is None:
        return (
            (None, {
                "fields": [
                    "username",
                    "password",
                    "role",
                    "employee_number",
                    "position",
                    "employee_branch",
                    "manager_branches",
                ]
            }),
        )

    # EDIT user: adjust based on role
    if obj.role == User.Roles.ADMIN:
        return (
            (None, {"fields": ["username", "password", "role"]}),
            ("Permissions", {"fields": ["is_active", "is_staff", "is_superuser", "groups", "user_permissions"]}),
        )

    if obj.role == User.Roles.MANAGER:
        return (
            (None, {"fields": ["username", "password", "role", "employee_number", "position"]}),
            ("Manager Assignment", {"fields": ["manager_branches"]}),
            ("Permissions", {"fields": ["is_active"]}),
        )

    if obj.role == User.Roles.EMPLOYEE:
        return (
            (None, {"fields": ["username", "password", "role", "employee_number", "position", "employee_branch"]}),
            ("Permissions", {"fields": ["is_active"]}),
        )

    return super(UserAdmin, self).get_fieldsets(request, obj)






admin.site.register(User, UserAdmin)


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "department",
        "min_required_level",
        "cl1_min_points",
        "cl2_min_points",
        "cl3_min_points",
        "cl4_min_points",
    )
    list_filter = ("department", "min_required_level")
    search_fields = ("name", "department")

    fieldsets = (
        (None, {
            "fields": ["name", "department", "min_required_level"],
        }),
        ("Per-position level thresholds (points required to reach each CL)", {
            "fields": ["cl1_min_points", "cl2_min_points", "cl3_min_points", "cl4_min_points"],
            "description": (
                "Note: User.get_competency_level() currently reads from the global "
                "LevelThresholdSetting, not these per-position fields. Set these only "
                "if you plan to switch to per-position thresholds."
            ),
        }),
    )

    class PositionCompetencyRequirementInline(admin.TabularInline):
        model = PositionCompetencyRequirement
        extra = 1
        fields = ("competency", "branch", "frequency", "priority_points", "required")
        autocomplete_fields = ("competency", "branch")

    inlines = [PositionCompetencyRequirementInline]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'kind', 'title', 'is_read', 'created_at')
    list_filter = ('kind', 'is_read', 'created_at')
    search_fields = ('user__username', 'title', 'body')
    raw_id_fields = ('user',)
    readonly_fields = ('created_at',)
