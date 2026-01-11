from django.contrib import admin
from django import forms
from .models import User, Position
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
    list_display = ["username", "role", "employee_number", "employee_branch", "position"]
    list_filter = ["role", "employee_branch"]
    search_fields = ["username", "employee_number"]
    filter_horizontal = ["manager_branches"]

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

        return super().get_fieldsets(request, obj)






admin.site.register(User, UserAdmin)


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "min_required_level",
    )
    search_fields = ("name",)

    def get_fieldsets(self, request, obj=None):
        return (
            (None, {"fields": ["name", "min_required_level"]}),
        )

    class PositionCompetencyRequirementInline(admin.TabularInline):
        model = PositionCompetencyRequirement
        extra = 1
        fields = ("competency", "branch", "frequency", "priority_points", "required")
        autocomplete_fields = ("competency", "branch")

    inlines = [PositionCompetencyRequirementInline]
