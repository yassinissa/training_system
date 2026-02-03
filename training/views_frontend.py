from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.http import HttpResponseForbidden
from django.utils import timezone
from django.http import FileResponse, Http404
from django.http import HttpResponse
from django.db.models import Q, Count
import csv
from io import StringIO
from datetime import timedelta, date
import json

from training.models import (
    ExamTemplate,
    Question,
    QuestionChoice,
    ExamSession,
    ExamAnswer,
    PositionCompetencyRequirement,
)
from accounts.models import Position
from branches.models import Branch
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from training.serializers import CompetencySerializer, ExamTemplateSerializer


@login_required
def exams_list_page(request):
    """
    Minimal page to list exams visible to the current user,
    mirroring the logic from ExamTemplateListView (API).
    """
    user = request.user
    # Role-aware landing redirects after login
    if getattr(user, "is_manager", None) and user.is_manager():
        return redirect("web-manager-dashboard")
    if getattr(user, "is_employee", None) and user.is_employee():
        return redirect("web-employee-dashboard")
    qs = ExamTemplate.objects.filter(is_active=True)

    branch_param = request.GET.get("branch")
    competency_param = request.GET.get("competency")
    position_param = request.GET.get("position")

    if getattr(user, "is_admin", None) and user.is_admin() or getattr(user, "is_manager", None) and user.is_manager():
        if competency_param:
            qs = qs.filter(competency_id=competency_param)
        if getattr(user, "is_manager", None) and user.is_manager():
            allowed = PositionCompetencyRequirement.objects.filter(
                branch__in=user.manager_branches.all() if not branch_param else [branch_param]
            )
            if position_param:
                allowed = allowed.filter(position_id=position_param)
            qs = qs.filter(competency_id__in=allowed.values_list("competency_id", flat=True))
    else:
        # Employees: only exams for their position/branch via requirements
        competency_ids = PositionCompetencyRequirement.objects.filter(
            position=user.position,
            branch=user.employee_branch,
        ).values_list("competency_id", flat=True)
        qs = qs.filter(competency_id__in=competency_ids)

    exams = qs.select_related("competency").order_by("created_at")

    taken_exam_ids = []
    if getattr(user, "is_employee", None) and user.is_employee():
        taken_exam_ids = list(
            ExamSession.objects.filter(employee=user).values_list("exam_id", flat=True).distinct()
        )

    # Debug context to help verify gating
    debug = {
        "role": getattr(user, "role", None),
        "position_name": getattr(getattr(user, "position", None), "name", None),
        "branch_name": getattr(getattr(user, "employee_branch", None), "name", None),
        "requirements_count": 0,
        "allowed_competency_ids": [],
        "exams_count": exams.count(),
        "active_exam_competency_ids": list(exams.values_list("competency_id", flat=True)),
    }

    if getattr(user, "is_manager", None) and user.is_manager():
        allowed_req = PositionCompetencyRequirement.objects.filter(
            branch__in=user.manager_branches.all() if not branch_param else [branch_param]
        )
        if position_param:
            allowed_req = allowed_req.filter(position_id=position_param)
        debug["requirements_count"] = allowed_req.count()
        debug["allowed_competency_ids"] = list(allowed_req.values_list("competency_id", flat=True))
    else:
        allowed_req = PositionCompetencyRequirement.objects.filter(
            position=user.position,
            branch=user.employee_branch,
        )
        debug["requirements_count"] = allowed_req.count()
        debug["allowed_competency_ids"] = list(allowed_req.values_list("competency_id", flat=True))

    return render(
        request,
        "training/exams_list.html",
        {"exams": exams, "debug": debug, "taken_exam_ids": taken_exam_ids},
    )


@login_required
def publish_requirements_page(request):
    """
    Simple manager UI to publish competencies to positions within a branch,
    creating PositionCompetencyRequirement entries.
    """
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can publish requirements.")

    branches = Branch.objects.all() if user.is_admin() else user.manager_branches.all()
    positions = Position.objects.all()
    # Show only competencies that require exams (optional)
    from training.models import Competency
    competencies = Competency.objects.filter(requires_exam=True)

    if request.method == "POST":
        branch_id = request.POST.get("branch_id")
        competency_id = request.POST.get("competency_id")
        position_ids = request.POST.getlist("position_ids")
        required = request.POST.get("required") == "on"
        frequency = request.POST.get("frequency") or None
        priority_points = request.POST.get("priority_points") or None

        if not branch_id or not competency_id or not position_ids:
            return render(
                request,
                "training/publish_requirements.html",
                {
                    "branches": branches,
                    "positions": positions,
                    "competencies": competencies,
                    "error": "Branch, competency, and at least one position are required.",
                },
            )

        created = 0
        updated = 0
        for pid in position_ids:
            obj, was_created = PositionCompetencyRequirement.objects.get_or_create(
                position_id=pid,
                competency_id=competency_id,
                branch_id=branch_id,
                defaults={
                    "frequency": frequency,
                    "priority_points": int(priority_points) if priority_points else 0,
                    "required": required,
                },
            )
            if not was_created:
                changed = False
                if frequency is not None:
                    obj.frequency = frequency; changed = True
                if priority_points is not None:
                    obj.priority_points = int(priority_points); changed = True
                obj.required = required; changed = True
                if changed:
                    obj.save(); updated += 1
                else:
                    updated += 1
            else:
                created += 1

        return render(
            request,
            "training/publish_requirements.html",
            {
                "branches": branches,
                "positions": positions,
                "competencies": competencies,
                "message": f"Published: {created}, Updated: {updated}",
            },
        )

    return render(
        request,
        "training/publish_requirements.html",
        {
            "branches": branches,
            "positions": positions,
            "competencies": competencies,
        },
    )


@login_required
def manager_dashboard_page(request):
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can access the manager dashboard.")
    from training.models import ExamTemplate, Competency
    from accounts.models import Position, User as Employee
    # Handle add employee to branch
    message = None
    error = None
    if request.method == "POST" and request.POST.get("form_type") == "add_employee":
        emp_no = (request.POST.get("employee_number") or "").strip()
        name = (request.POST.get("name") or "").strip()
        position_id = request.POST.get("position_id")
        branch_id = request.POST.get("branch_id")
        # Basic validation
        if not emp_no:
            error = "Employee number is required."
        elif not position_id:
            error = "Position is required."
        elif not branch_id:
            error = "Branch is required."
        else:
            from branches.models import Branch
            try:
                pos = Position.objects.get(id=position_id)
                br = Branch.objects.get(id=branch_id)
                # Managers can only add to their assigned branches
                if user.is_manager() and br.id not in set(user.manager_branches.values_list("id", flat=True)):
                    error = "You can only add employees to your branches."
                else:
                    # Username will be employee number to keep login simple
                    username = emp_no
                    # Split name into first/last if provided
                    first_name = name
                    last_name = ""
                    # Generate a temporary password
                    # Use employee number as initial password for simplicity
                    temp_password = emp_no
                    # Create employee
                    e = Employee(
                        username=username,
                        role=Employee.Roles.EMPLOYEE,
                        employee_number=emp_no,
                        position=pos,
                        employee_branch=br,
                        first_name=first_name,
                        last_name=last_name,
                    )
                    e.set_password(temp_password)
                    e.save()
                    message = f"Employee created: {e.get_full_name or e.username} (Emp No: {emp_no}). Initial password set to employee number."
            except Position.DoesNotExist:
                error = "Selected position not found."
            except Branch.DoesNotExist:
                error = "Selected branch not found."
            except Exception as ex:
                error = f"Could not create employee: {ex}"

    exams = ExamTemplate.objects.filter(created_by=user).order_by("-created_at") if user.is_manager() else ExamTemplate.objects.all().order_by("-created_at")
    comps = Competency.objects.filter(created_by=user).order_by("-created_at")[:20] if user.is_manager() else Competency.objects.all().order_by("-created_at")[:20]
    # Branch options limited for managers
    from branches.models import Branch
    branches = Branch.objects.all() if user.is_admin() else user.manager_branches.all()
    positions = Position.objects.all().order_by("name")
    return render(request, "training/manager_dashboard.html", {"exams": exams, "competencies": comps, "branches": branches, "positions": positions, "message": message, "error": error})


@login_required
def admin_dashboard_page(request):
    """Admin dashboard: branch management, filters, and analytics."""
    user = request.user
    if not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Admins only.")

    # Branch management (create/update/delete)
    message = None
    error = None
    if request.method == "POST" and request.POST.get("form_type") == "create_branch":
        name = (request.POST.get("name") or "").strip()
        location = (request.POST.get("location") or "").strip()
        target_str = request.POST.get("target")
        if not name:
            error = "Branch name is required."
        else:
            try:
                target = int(target_str) if target_str is not None and target_str != "" else 0
                target = max(0, min(100, target))
                Branch.objects.create(name=name, location=location, target_compliance_percent=target)
                message = "Branch created."
            except Exception as e:
                error = f"Could not create branch: {e}"

    if request.method == "POST" and request.POST.get("form_type") == "update_branch":
        branch_id = request.POST.get("branch_id")
        name = (request.POST.get("name") or "").strip()
        location = (request.POST.get("location") or "").strip()
        target_str = request.POST.get("target")
        try:
            b = Branch.objects.get(id=branch_id)
            if name:
                b.name = name
            b.location = location
            if target_str is not None and target_str != "":
                t = int(target_str)
                b.target_compliance_percent = max(0, min(100, t))
            b.save()
            message = "Branch updated."
        except Branch.DoesNotExist:
            error = "Branch not found."
        except Exception as e:
            error = f"Could not update branch: {e}"

    if request.method == "POST" and request.POST.get("form_type") == "delete_branch":
        branch_id = request.POST.get("branch_id")
        try:
            Branch.objects.filter(id=branch_id).delete()
            message = "Branch deleted."
        except Exception as e:
            error = f"Could not delete branch: {e}"

    # Manager registration & assignment
    if request.method == "POST" and request.POST.get("form_type") == "register_manager":
        from accounts.models import User
        username = (request.POST.get("username") or "").strip()
        employee_number = (request.POST.get("employee_number") or "").strip()
        password = (request.POST.get("password") or "").strip()
        email = (request.POST.get("email") or "").strip()
        position_id = request.POST.get("position_id") or None
        branch_ids = request.POST.getlist("branch_ids")
        if not username or not password or not employee_number or not position_id:
            error = "Username, employee number, password, and position are required for manager registration."
        else:
            try:
                if User.objects.filter(username=username).exists():
                    raise ValueError("Username already exists.")
                if User.objects.filter(employee_number=employee_number).exists():
                    raise ValueError("Employee number already exists.")
                # Validate position exists
                try:
                    pos_id_int = int(position_id)
                except ValueError:
                    raise ValueError("Invalid position.")
                if not Position.objects.filter(id=pos_id_int).exists():
                    raise ValueError("Selected position not found.")
                user = User.objects.create_user(username=username, password=password, email=email or None)
                user.role = User.Roles.MANAGER
                user.employee_number = employee_number
                user.position_id = pos_id_int
                user.save(update_fields=["role", "employee_number", "position"])
                # Assign branches
                if branch_ids:
                    user.manager_branches.set(Branch.objects.filter(id__in=branch_ids))
                message = "Manager registered and assigned to branches."
            except Exception as e:
                error = f"Could not register manager: {e}"

    # Admin: edit user/manager/employee
    if request.method == "POST" and request.POST.get("form_type") == "update_user":
        from accounts.models import User
        emp_no = (request.POST.get("employee_number") or "").strip()
        role = (request.POST.get("role") or "").strip()
        position_id = request.POST.get("position_id") or None
        employee_branch_id = request.POST.get("employee_branch_id") or None
        mgr_branch_ids = request.POST.getlist("manager_branch_ids")
        try:
            user_to_edit = User.objects.get(employee_number=emp_no)
            # Role update
            valid_roles = [User.Roles.ADMIN, User.Roles.MANAGER, User.Roles.EMPLOYEE]
            if role in valid_roles:
                user_to_edit.role = role
            # Position update
            if position_id not in (None, ""):
                user_to_edit.position_id = int(position_id)
            # Branch updates based on role
            if user_to_edit.role == User.Roles.EMPLOYEE:
                # Single branch
                user_to_edit.employee_branch_id = int(employee_branch_id) if employee_branch_id not in (None, "") else None
                user_to_edit.manager_branches.clear()
            elif user_to_edit.role == User.Roles.MANAGER:
                # Manager can have multi-branch assignment, avoid duplication with primary branch
                user_to_edit.employee_branch_id = int(employee_branch_id) if employee_branch_id not in (None, "") else None
                if mgr_branch_ids:
                    ids = [int(i) for i in mgr_branch_ids if i]
                    # exclude primary if present
                    primary_id = user_to_edit.employee_branch_id
                    if primary_id:
                        ids = [i for i in ids if i != primary_id]
                    user_to_edit.manager_branches.set(Branch.objects.filter(id__in=ids))
                else:
                    user_to_edit.manager_branches.clear()
            else:
                # Admins: clear assignments unless provided
                user_to_edit.employee_branch_id = int(employee_branch_id) if employee_branch_id not in (None, "") else None
                if mgr_branch_ids:
                    ids = [int(i) for i in mgr_branch_ids if i]
                    user_to_edit.manager_branches.set(Branch.objects.filter(id__in=ids))
                else:
                    user_to_edit.manager_branches.clear()
            user_to_edit.save()
            message = "User updated."
        except User.DoesNotExist:
            error = "User not found by employee number."
        except Exception as e:
            error = f"Could not update user: {e}"

    # Policy settings: update position thresholds and required level
    if request.method == "POST" and request.POST.get("form_type") == "update_position_policy":
        pos_id = request.POST.get("position_id")
        min_level = request.POST.get("min_required_level")
        cl1 = request.POST.get("cl1_min_points")
        cl2 = request.POST.get("cl2_min_points")
        cl3 = request.POST.get("cl3_min_points")
        cl4 = request.POST.get("cl4_min_points")
        try:
            p = Position.objects.get(id=pos_id)
            if min_level:
                p.min_required_level = min_level
            def to_int(v):
                return int(v) if v not in (None, "") else 0
            p.cl1_min_points = to_int(cl1)
            p.cl2_min_points = to_int(cl2)
            p.cl3_min_points = to_int(cl3)
            p.cl4_min_points = to_int(cl4)
            p.save()
            message = "Position policy updated."
        except Position.DoesNotExist:
            error = "Position not found."
        except Exception as e:
            error = f"Could not update position: {e}"

    # Saved views / export presets
    from training.models import SavedView, SchedulerSetting
    if request.method == "POST" and request.POST.get("form_type") == "create_saved_view":
        name = (request.POST.get("name") or "").strip()
        export_type = request.POST.get("export_type") or "compliance"
        # Capture common filters
        branch_id = request.POST.get("branch") or None
        position_id = request.POST.get("position") or None
        as_of = request.POST.get("as_of") or None
        frm = request.POST.get("from") or None
        to = request.POST.get("to") or None
        filters = {
            "branch": branch_id,
            "position": position_id,
        }
        if export_type == "compliance":
            filters["as_of"] = as_of
        else:
            filters["from"] = frm
            filters["to"] = to
        if not name:
            error = "Preset name is required."
        else:
            try:
                SavedView.objects.create(
                    owner=user,
                    name=name,
                    export_type=export_type,
                    filters_json=json.dumps(filters),
                )
                message = "Saved view created."
            except Exception as e:
                error = f"Could not create saved view: {e}"

    # Scheduler settings
    scheduler, _ = SchedulerSetting.objects.get_or_create(owner=user)
    if request.method == "POST" and request.POST.get("form_type") == "update_scheduler":
        enable_auto = request.POST.get("enable_auto_reminders") == "on"
        enable_reports = request.POST.get("enable_scheduled_reports") == "on"
        frequency = (request.POST.get("report_frequency") or "weekly").strip()
        try:
            scheduler.enable_auto_reminders = enable_auto
            scheduler.enable_scheduled_reports = enable_reports
            scheduler.report_frequency = frequency
            scheduler.save()
            message = "Scheduler settings updated."
        except Exception as e:
            error = f"Could not update scheduler: {e}"

    if request.method == "POST" and request.POST.get("form_type") == "run_scheduler_now":
        # Stub: compute expiring/yearly items count and store in last_result
        from training.models import PositionCompetencyRequirement, EmployeeCompetencyRecord, Frequency
        from accounts.models import User as Employee
        try:
            reqs = PositionCompetencyRequirement.objects.filter(required=True)
            employees = Employee.objects.filter(role=Employee.Roles.EMPLOYEE)
            today = date.today()
            expiring_count = 0
            for r in reqs.select_related("competency"):
                freq = r.frequency or getattr(r.competency, "frequency", None)
                if freq != Frequency.YEARLY:
                    continue
                for e in employees:
                    rec = EmployeeCompetencyRecord.objects.filter(employee=e, competency=r.competency).order_by("-date_completed").first()
                    if rec and rec.date_completed:
                        expiry = rec.date_completed + timedelta(days=365)
                        if (expiry - today).days <= 30:
                            expiring_count += 1
            scheduler.last_run = timezone.now()
            scheduler.last_result = f"Checked reminders. Expiring within 30 days: {expiring_count}."
            scheduler.save()
            message = "Scheduler run completed."
        except Exception as e:
            error = f"Scheduler run failed: {e}"

    branches = Branch.objects.all().order_by("name")

    # Analytics summary (compute directly to avoid DRF auth context issues)
    from training.models import ExamSession, EmployeeCompetencyRecord, ExamTemplate, Competency, PositionCompetencyRequirement
    from accounts.models import User as Employee

    sessions_qs = ExamSession.objects.all()
    records_qs = EmployeeCompetencyRecord.objects.all()
    summary = {
        "sessions_by_status": list(sessions_qs.values("status").annotate(count=Count("id"))),
        "records_by_status": list(records_qs.values("status").annotate(count=Count("id"))),
        "exams_active_count": ExamTemplate.objects.filter(is_active=True).count(),
        "competencies_count": Competency.objects.count(),
    }

    # Non-compliance snapshot (admins: across all branches)
    req_qs = PositionCompetencyRequirement.objects.filter(required=True).select_related("competency", "position", "branch")
    emp_qs = Employee.objects.filter(role=Employee.Roles.EMPLOYEE).select_related("position", "employee_branch")

    requirements_by_key = {}
    for r in req_qs:
        key = (r.position_id, r.branch_id)
        requirements_by_key.setdefault(key, []).append(r)

    non_compliant = []
    level_rank = {"CL0": 0, "CL1": 1, "CL2": 2, "CL3": 3, "CL4": 4}
    for emp in emp_qs:
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
                "employee_number": emp.employee_number,
                "position": emp.position.name if emp.position else None,
                "branch": emp.employee_branch.name if emp.employee_branch else None,
                "missing_competencies": missing,
                "below_min_level": below_min_level,
            })

    non_compliance = {
        "total_employees_checked": emp_qs.count(),
        "non_compliant_count": len(non_compliant),
        "non_compliant": non_compliant,
    }

    # Optional filter shortcuts
    employee_number = (request.GET.get("employee_number") or "").strip()
    branch_filter_id = request.GET.get("branch")

    # Exception reports
    from accounts.models import User as Employee
    # Unassigned users (no branch)
    unassigned_users = list(Employee.objects.filter(role=Employee.Roles.EMPLOYEE, employee_branch__isnull=True).values("id", "username"))
    # Managers with no branch assignment
    managers_no_branches = list(Employee.objects.filter(role=Employee.Roles.MANAGER, manager_branches__isnull=True).distinct().values("id", "username"))
    # Branches without managers
    branches_without_managers = list(Branch.objects.filter(managers__isnull=True).distinct().values("id", "name"))
    # Duplicate employee numbers
    from django.db.models import Count as DCount
    dup_numbers = (
        Employee.objects.exclude(employee_number__isnull=True).exclude(employee_number="")
        .values("employee_number").annotate(c=DCount("id")).filter(c__gt=1)
    )
    duplicate_employee_numbers = [
        {"employee_number": d["employee_number"], "count": d["c"]} for d in dup_numbers
    ]
    # High-risk non-compliant roles (top positions with most non-compliant)
    from collections import Counter
    pos_counter = Counter([n.get("position") for n in non_compliant if n.get("position")])
    high_risk_roles = [
        {"position": p, "count": c} for p, c in pos_counter.most_common(10)
    ]
    exceptions = {
        "unassigned_users": unassigned_users,
        "managers_no_branches": managers_no_branches,
        "branches_without_managers": branches_without_managers,
        "duplicate_employee_numbers": duplicate_employee_numbers,
        "high_risk_roles": high_risk_roles,
    }

    # Dashboard layout preferences (session-based)
    if request.method == "POST" and request.POST.get("form_type") == "update_layout":
        for key in ["hide_analytics", "hide_exceptions", "hide_policy", "hide_saved_views", "hide_scheduler"]:
            request.session[key] = request.POST.get(key) == "on"
    layout = {
        "hide_analytics": bool(request.session.get("hide_analytics")),
        "hide_exceptions": bool(request.session.get("hide_exceptions")),
        "hide_policy": bool(request.session.get("hide_policy")),
        "hide_saved_views": bool(request.session.get("hide_saved_views")),
        "hide_scheduler": bool(request.session.get("hide_scheduler")),
    }

    # Load saved views for quick exports
    saved_views = list(SavedView.objects.filter(owner=user).order_by("-created_at"))
    saved_views_ctx = []
    for sv in saved_views:
        try:
            f = json.loads(sv.filters_json or "{}")
        except Exception:
            f = {}
        if sv.export_type == "compliance":
            params = []
            if f.get("branch"): params.append(f"branch={f.get('branch')}")
            if f.get("position"): params.append(f"position={f.get('position')}")
            if f.get("as_of"): params.append(f"as_of={f.get('as_of')}")
            export_url = request.build_absolute_uri(f"/web/exams/manager/reports/export/compliance.csv?{'&'.join(params)}")
        else:
            params = []
            if f.get("branch"): params.append(f"branch={f.get('branch')}")
            if f.get("from"): params.append(f"from={f.get('from')}")
            if f.get("to"): params.append(f"to={f.get('to')}")
            export_url = request.build_absolute_uri(f"/web/exams/manager/reports/export/sessions.csv?{'&'.join(params)}")
        saved_views_ctx.append({
            "id": sv.id,
            "name": sv.name,
            "export_type": sv.export_type,
            "export_url": export_url,
        })

    return render(
        request,
        "training/admin_dashboard.html",
        {
            "branches": branches,
            "message": message,
            "error": error,
            "summary": summary,
            "non_compliance": non_compliance,
            "exceptions": exceptions,
            "layout": layout,
            "employee_number": employee_number,
            "branch_filter_id": int(branch_filter_id) if branch_filter_id else None,
            "positions": Position.objects.all().order_by("name"),
            "saved_views": saved_views_ctx,
            "scheduler": scheduler,
        },
    )


@login_required
def manager_employee_lookup_page(request):
    """Managers/Admins: lookup employee by employee number or list branch staff.
    Shows profile, position/branch, competency history, exam history, and computed level.
    """
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can access this page.")

    from accounts.models import User as Employee
    from training.models import EmployeeCompetencyRecord

    employee_number = request.GET.get("employee_number", "").strip()
    branch_id = request.GET.get("branch") or None

    # Branch options limited for managers
    branches = Branch.objects.all() if user.is_admin() else user.manager_branches.all()

    selected_employee = None
    employee_records = []
    employee_sessions = []
    employee_level = None
    total_points = 0
    message = None
    error = None

    # Search by employee number (include managers). Managers can view other managers even if not in their branches.
    if employee_number:
        selected_employee = Employee.objects.filter(employee_number=employee_number).select_related("position", "employee_branch").first()

        # Restrict manager's access to employees outside their branches, but allow viewing managers.
        if selected_employee and user.is_manager():
            if selected_employee.role == Employee.Roles.EMPLOYEE:
                allowed_branches = set(user.manager_branches.values_list("id", flat=True))
                if selected_employee.employee_branch_id not in allowed_branches:
                    selected_employee = None

        if selected_employee:
            # Optional: Assign employee-specific competency requirement via POST
            if request.method == "POST" and request.POST.get("form_type") == "assign_competency":
                from training.models import EmployeeCompetencyRequirement as EmpReq, Competency
                try:
                    comp_id = request.POST.get("competency_id")
                    frequency = request.POST.get("frequency") or None
                    required = request.POST.get("required") == "on"
                    if not comp_id:
                        error = "Select a competency to assign."
                    else:
                        comp = Competency.objects.get(id=comp_id)
                        # Managers can only assign within their branches
                        if user.is_manager():
                            allowed = set(user.manager_branches.values_list("id", flat=True))
                            if selected_employee.employee_branch_id not in allowed:
                                error = "You can only assign to employees in your branches."
                        if not error:
                            obj, created = EmpReq.objects.get_or_create(
                                employee=selected_employee,
                                competency=comp,
                                branch=selected_employee.employee_branch,
                            )
                            obj.frequency = frequency
                            obj.required = required
                            obj.save()
                            message = "Competency assigned to employee." if created else "Employee requirement updated."
                except Competency.DoesNotExist:
                    error = "Chosen competency not found."
                except Exception as ex:
                    error = f"Could not assign requirement: {ex}"
            # List employee-specific requirements
            from training.models import EmployeeCompetencyRequirement as EmpReq
            employee_direct_requirements = list(
                EmpReq.objects.select_related("competency", "branch").filter(employee=selected_employee).order_by("competency__title")
            )
            employee_records = list(
                EmployeeCompetencyRecord.objects.select_related("competency").filter(employee=selected_employee).order_by("-date_completed", "-id")
            )
            employee_sessions = list(
                ExamSession.objects.select_related("exam", "exam__competency").filter(employee=selected_employee).order_by("-started_at")[:200]
            )
            total_points = selected_employee.get_total_points()
            employee_level = selected_employee.get_competency_level()
            # Manager branches (single consolidated list without duplicates)
            selected_manager_branches = []
            if selected_employee.role == Employee.Roles.MANAGER:
                try:
                    seen = set()
                    # include primary branch if set
                    if selected_employee.employee_branch_id:
                        selected_manager_branches.append(selected_employee.employee_branch)
                        seen.add(selected_employee.employee_branch_id)
                    # include assigned manager branches excluding duplicates
                    for b in selected_employee.manager_branches.all():
                        if b.id not in seen:
                            selected_manager_branches.append(b)
                            seen.add(b.id)
                except Exception:
                    selected_manager_branches = []

    # List branch staff (all branches or a specific branch)
    branch_staff = []
    branch_managers = []
    staff_qs = Employee.objects.select_related("position", "employee_branch")
    if user.is_manager():
        # Managers see staff only within their assigned branches
        staff_qs = staff_qs.filter(employee_branch__in=user.manager_branches.all())
    if branch_id:
        # Narrow to a specific branch if provided
        staff_qs = staff_qs.filter(employee_branch_id=branch_id)
    branch_staff = list(staff_qs.order_by("username")[:500])

    # Include managers only when a specific branch is selected
    if branch_id:
        mgr_qs = (
            Employee.objects.select_related("position")
            .filter(role=Employee.Roles.MANAGER, manager_branches__id=branch_id)
            .distinct()
        )
        if user.is_manager():
            mgr_qs = mgr_qs.filter(manager_branches__in=user.manager_branches.all())
        branch_managers = list(mgr_qs.order_by("username")[:200])

    return render(
        request,
        "training/manager_employee_lookup.html",
        {
            "employee_number": employee_number,
            "branches": branches,
            "current_branch_id": int(branch_id) if branch_id else None,
            "selected_employee": selected_employee,
            "employee_records": employee_records,
            "employee_sessions": employee_sessions,
            "employee_level": employee_level,
            "total_points": total_points,
            "branch_staff": branch_staff,
                "branch_managers": branch_managers,
            "selected_manager_branches": locals().get("selected_manager_branches", []),
            "message": message,
            "error": error,
            "competencies_all": __import__("training.models", fromlist=["Competency"]).Competency.objects.all().order_by("title") if selected_employee else [],
            "employee_direct_requirements": locals().get("employee_direct_requirements", []),
        },
    )


@login_required
def expiring_competencies_page(request):
    """Upcoming renewals based on frequency (YEARLY), with filters and quick actions."""
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can view expiring competencies.")

    from training.models import PositionCompetencyRequirement, EmployeeCompetencyRecord, Frequency
    from accounts.models import User as Employee

    # Filters
    branch_id = request.GET.get("branch") or None
    position_id = request.GET.get("position") or None
    window_days = int(request.GET.get("window", 90) or 90)

    # Quick action: mark employee competency as RETRAIN to trigger follow-up
    if request.method == "POST" and request.POST.get("action") == "retrain":
        emp_id = request.POST.get("employee_id")
        comp_id = request.POST.get("competency_id")
        try:
            rec, _ = EmployeeCompetencyRecord.objects.get_or_create(employee_id=emp_id, competency_id=comp_id)
            # Do not override PASSED date; just set status to RETRAIN
            rec.status = EmployeeCompetencyRecord.Status.RETRAIN
            rec.save(update_fields=["status"])
        except Exception:
            pass
        return redirect("web-expiring-competencies")

    # Scope requirements to YEARLY ones
    req_qs = PositionCompetencyRequirement.objects.filter(required=True)
    if user.is_manager():
        req_qs = req_qs.filter(branch__in=user.manager_branches.all())
    if branch_id:
        req_qs = req_qs.filter(branch_id=branch_id)
    if position_id:
        req_qs = req_qs.filter(position_id=position_id)

    # Employees in scope
    emp_qs = Employee.objects.filter(role=Employee.Roles.EMPLOYEE)
    if user.is_manager():
        emp_qs = emp_qs.filter(employee_branch__in=user.manager_branches.all())
    if branch_id:
        emp_qs = emp_qs.filter(employee_branch_id=branch_id)
    if position_id:
        emp_qs = emp_qs.filter(position_id=position_id)

    today = date.today()
    expiring = []
    overdue = []

    # Map employees for quick lookup
    employees = {e.id: e for e in emp_qs.select_related("position", "employee_branch")}

    # Determine expiry per frequency
    def compute_expiry(d_completed, freq):
        if not d_completed:
            return None
        if freq == Frequency.YEARLY:
            return d_completed + timedelta(days=365)
        # Event-based or one-time → no fixed expiry
        return None

    for r in req_qs.select_related("competency", "position", "branch"):
        # Effective frequency: requirement override or competency default
        freq = r.frequency or getattr(r.competency, "frequency", None)
        if freq != Frequency.YEARLY:
            continue

        # Find employees matching this position/branch
        for e in employees.values():
            if getattr(e.position, "id", None) != r.position_id:
                continue
            if getattr(e.employee_branch, "id", None) != r.branch_id:
                continue

            rec = EmployeeCompetencyRecord.objects.filter(employee=e, competency=r.competency).order_by("-date_completed").first()
            expiry_date = compute_expiry(getattr(rec, "date_completed", None), freq)
            if not expiry_date:
                # No completion yet → treat as overdue
                overdue.append({
                    "employee": e,
                    "requirement": r,
                    "status": getattr(rec, "status", EmployeeCompetencyRecord.Status.NOT_STARTED),
                    "expiry_date": None,
                    "days_remaining": None,
                })
                continue

            days_remaining = (expiry_date - today).days
            item = {
                "employee": e,
                "requirement": r,
                "record": rec,
                "expiry_date": expiry_date,
                "days_remaining": days_remaining,
            }
            if days_remaining < 0:
                overdue.append(item)
            elif days_remaining <= window_days:
                expiring.append(item)

    # Sort
    expiring.sort(key=lambda x: x["days_remaining"])
    overdue.sort(key=lambda x: (x["days_remaining"] or -9999))

    # Filters data
    branches = Branch.objects.all() if user.is_admin() else user.manager_branches.all()
    positions = Position.objects.all()

    return render(
        request,
        "training/manager_expiring.html",
        {
            "expiring": expiring,
            "overdue": overdue,
            "window_days": window_days,
            "branches": branches,
            "positions": positions,
            "current_branch_id": int(branch_id) if branch_id else None,
            "current_position_id": int(position_id) if position_id else None,
        },
    )


@login_required
def grading_queue_page(request):
    """Pending manual grading sessions with counts, SLA timers, and quick links."""
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can view grading queue.")

    from training.models import ExamSession, ExamAnswer, Question

    qs = ExamSession.objects.select_related("employee", "exam").filter(status=ExamSession.Status.SUBMITTED)
    if user.is_manager():
        qs = qs.filter(employee__employee_branch__in=user.manager_branches.all())

    sessions = []
    manual_count = 0
    auto_only = 0
    now = timezone.now()

    for s in qs.order_by("-submitted_at"):
        answers = list(ExamAnswer.objects.select_related("question").filter(session=s))
        manual_needed = any(
            a.question.type in [
                Question.QuestionType.MCQ_MULTI,
                Question.QuestionType.SHORT_TEXT,
                Question.QuestionType.LONG_TEXT,
            ]
            for a in answers
        )
        manual_count += 1 if manual_needed else 0
        auto_only += 1 if not manual_needed else 0

        sla_hours = None
        if s.submitted_at:
            delta = now - s.submitted_at
            sla_hours = int(delta.total_seconds() // 3600)

        sessions.append({
            "session": s,
            "manual_needed": manual_needed,
            "sla_hours": sla_hours,
        })

    return render(
        request,
        "training/manager_grading_queue.html",
        {
            "sessions": sessions,
            "manual_count": manual_count,
            "auto_only": auto_only,
        },
    )


@login_required
def employee_insights_page(request):
    """Performance summary, skill gaps, and recommended next competencies."""
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can view employee insights.")

    from accounts.models import User as Employee
    from training.models import EmployeeCompetencyRecord, PositionCompetencyRequirement

    employee_id = request.GET.get("employee")
    branches = Branch.objects.all() if user.is_admin() else user.manager_branches.all()

    selected = None
    insights = {}
    gaps = []
    recommendations = []

    if employee_id:
        qs = Employee.objects.all()
        if user.is_manager():
            qs = qs.filter(employee_branch__in=user.manager_branches.all())
        selected = qs.select_related("position", "employee_branch").filter(id=employee_id).first()

        if selected:
            total_points = selected.get_total_points()
            level = selected.get_competency_level()
            insights = {
                "total_points": total_points,
                "level": level,
                "position": getattr(selected.position, "name", None),
                "branch": getattr(selected.employee_branch, "name", None),
            }

            reqs = PositionCompetencyRequirement.objects.filter(
                position=selected.position,
                branch=selected.employee_branch,
                required=True,
            ).select_related("competency")
            passed_ids = set(
                EmployeeCompetencyRecord.objects.filter(
                    employee=selected,
                    status=EmployeeCompetencyRecord.Status.PASSED,
                ).values_list("competency_id", flat=True)
            )
            for r in reqs:
                if r.competency_id not in passed_ids:
                    gaps.append(r)

            # Recommend by priority points (missing first)
            recommendations = sorted(gaps, key=lambda x: x.priority_points, reverse=True)[:10]

    # Employees list for selection
    employees = Employee.objects.filter(role=Employee.Roles.EMPLOYEE)
    if user.is_manager():
        employees = employees.filter(employee_branch__in=user.manager_branches.all())

    return render(
        request,
        "training/manager_employee_insights.html",
        {
            "branches": branches,
            "employees": employees.order_by("username")[:500],
            "selected": selected,
            "insights": insights,
            "gaps": gaps,
            "recommendations": recommendations,
        },
    )


@login_required
def reports_exports_page(request):
    """Simple UI to export CSVs for compliance and sessions, with filters."""
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can export reports.")

    branches = Branch.objects.all() if getattr(user, "is_admin", None) and user.is_admin() else user.manager_branches.all()
    positions = Position.objects.all()
    return render(request, "training/reports_exports.html", {"branches": branches, "positions": positions})


@login_required
def export_compliance_csv(request):
    """CSV export using same logic as NonComplianceReportView, without DRF wrapper."""
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Not allowed")

    from training.models import PositionCompetencyRequirement, EmployeeCompetencyRecord
    from accounts.models import User as Employee

    branch_id = request.GET.get("branch")
    position_id = request.GET.get("position")
    as_of_str = request.GET.get("as_of")  # YYYY-MM-DD
    as_of_date = None
    if as_of_str:
        try:
            as_of_date = date.fromisoformat(as_of_str)
        except Exception:
            as_of_date = None

    req_qs = PositionCompetencyRequirement.objects.filter(required=True)
    if getattr(user, "is_manager", None) and user.is_manager():
        req_qs = req_qs.filter(branch__in=user.manager_branches.all())
    if branch_id:
        req_qs = req_qs.filter(branch_id=branch_id)
    if position_id:
        req_qs = req_qs.filter(position_id=position_id)

    emp_qs = Employee.objects.filter(role=Employee.Roles.EMPLOYEE)
    if getattr(user, "is_manager", None) and user.is_manager():
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
    level_rank = {"CL0": 0, "CL1": 1, "CL2": 2, "CL3": 3, "CL4": 4}

    for emp in emp_qs.select_related("position", "employee_branch"):
        key = (getattr(emp.position, "id", None), getattr(emp.employee_branch, "id", None))
        reqs = requirements_by_key.get(key, [])
        missing = []

        for r in reqs:
            rec_qs = EmployeeCompetencyRecord.objects.filter(
                employee=emp,
                competency=r.competency,
                status=EmployeeCompetencyRecord.Status.PASSED,
            )
            if as_of_date:
                rec_qs = rec_qs.filter(date_completed__lte=as_of_date)
            has_passed = rec_qs.exists()
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

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["employee_id", "username", "position", "branch", "below_min_level", "missing_titles"])
    for item in non_compliant:
        missing_titles = "; ".join([m.get("title") or "" for m in item.get("missing_competencies", [])])
        writer.writerow([
            item.get("employee_id"),
            item.get("username"),
            item.get("position"),
            item.get("branch"),
            item.get("below_min_level"),
            missing_titles,
        ])

    response = HttpResponse(output.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = "attachment; filename=compliance_report.csv"
    return response


@login_required
def export_sessions_csv(request):
    """CSV export of sessions in scope."""
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Not allowed")

    from training.models import ExamSession
    qs = ExamSession.objects.select_related("employee", "exam")
    if user.is_manager():
        qs = qs.filter(employee__employee_branch__in=user.manager_branches.all())

    branch_id = request.GET.get("branch")
    if branch_id:
        qs = qs.filter(employee__employee_branch_id=branch_id)

    # Optional date range filters (submitted_at date)
    from_str = request.GET.get("from")  # YYYY-MM-DD
    to_str = request.GET.get("to")      # YYYY-MM-DD
    from_date = None
    to_date = None
    try:
        if from_str:
            from_date = date.fromisoformat(from_str)
        if to_str:
            to_date = date.fromisoformat(to_str)
    except Exception:
        from_date = from_date or None
        to_date = to_date or None

    if from_date:
        qs = qs.filter(submitted_at__date__gte=from_date)
    if to_date:
        qs = qs.filter(submitted_at__date__lte=to_date)

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["session_id", "status", "employee", "branch", "exam", "score", "max_score", "submitted_at"])
    for s in qs.order_by("-submitted_at")[:5000]:
        writer.writerow([
            s.id,
            s.status,
            getattr(s.employee, "username", None),
            getattr(getattr(s.employee, "employee_branch", None), "name", None),
            getattr(s.exam, "title", None),
            s.score,
            s.max_score,
            s.submitted_at.isoformat() if s.submitted_at else "",
        ])

    response = HttpResponse(output.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = "attachment; filename=sessions_report.csv"
    return response


@login_required
def manage_competencies_page(request):
    """List and allow creation of competencies for managers/admins."""
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can manage competencies.")

    from training.models import Competency, Frequency

    message = None
    error = None

    if request.method == "POST" and request.POST.get("form_type") == "create_competency":
        ref = request.POST.get("reference_number")
        title = request.POST.get("title")
        duration = request.POST.get("duration") or None
        frequency = request.POST.get("frequency") or Frequency.ONE_TIME
        priority_points = request.POST.get("priority_points") or 0
        area = request.POST.get("competency_area") or None
        brand = request.POST.get("brand") or None
        requires_exam = request.POST.get("requires_exam") == "on"
        description = request.POST.get("description") or ""
        content = request.POST.get("content") or ""
        external_link = request.POST.get("external_link") or None
        pdf_file = request.FILES.get("pdf_file")
        image = request.FILES.get("image")

        if not ref or not title:
            error = "Reference number and Title are required."
        else:
            try:
                comp = Competency(
                    reference_number=ref,
                    title=title,
                    duration=duration,
                    frequency=frequency,
                    priority_points=int(priority_points) if priority_points else 0,
                    competency_area=area,
                    brand=brand,
                    requires_exam=requires_exam,
                    description=description,
                    content=content,
                    external_link=external_link,
                    created_by=user,
                )
                if pdf_file:
                    comp.pdf_file = pdf_file
                if image:
                    comp.image = image
                comp.save()
                return redirect("web-manage-competencies")
            except Exception as e:
                error = f"Could not create competency: {e}"

    # List all competencies (admins see all, managers see their own by default)
    if getattr(user, "is_admin", None) and user.is_admin():
        comps = Competency.objects.all().order_by("title")
    else:
        comps = Competency.objects.filter(created_by=user).order_by("title")

    return render(
        request,
        "training/manager_competencies.html",
        {
            "competencies": comps,
            "message": message,
            "error": error,
            "frequency_choices": list(Frequency.choices),
        },
    )


@login_required
def edit_competency_page(request, comp_id: int):
    """Edit or delete a competency."""
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can edit competencies.")

    from training.models import Competency, Frequency

    try:
        comp_qs = Competency.objects
        if getattr(user, "is_manager", None) and user.is_manager() and not (getattr(user, "is_admin", None) and user.is_admin()):
            comp_qs = comp_qs.filter(created_by=user)
        comp = comp_qs.get(id=comp_id)
    except Competency.DoesNotExist:
        return HttpResponseForbidden("Competency not found or not allowed.")

    message = None
    error = None

    if request.method == "POST":
        form_type = request.POST.get("form_type")
        if form_type == "delete_competency":
            comp.delete()
            return redirect("web-manage-competencies")

        if form_type == "update_competency":
            comp.reference_number = request.POST.get("reference_number") or comp.reference_number
            comp.title = request.POST.get("title") or comp.title
            comp.duration = request.POST.get("duration") or None
            comp.frequency = request.POST.get("frequency") or comp.frequency
            pp = request.POST.get("priority_points")
            comp.priority_points = int(pp) if pp is not None and pp != "" else comp.priority_points
            comp.competency_area = request.POST.get("competency_area") or None
            comp.brand = request.POST.get("brand") or None
            comp.requires_exam = request.POST.get("requires_exam") == "on"
            comp.description = request.POST.get("description") or ""
            comp.content = request.POST.get("content") or ""
            comp.external_link = request.POST.get("external_link") or None

            pdf_file = request.FILES.get("pdf_file")
            image = request.FILES.get("image")
            if pdf_file:
                comp.pdf_file = pdf_file
            if image:
                comp.image = image

            try:
                comp.save()
                message = "Competency updated."
            except Exception as e:
                error = f"Could not update competency: {e}"

    return render(
        request,
        "training/manager_competency_edit.html",
        {
            "comp": comp,
            "message": message,
            "error": error,
            "frequency_choices": list(Frequency.choices),
        },
    )


@login_required
def create_exam_page(request):
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can create exams.")

    from training.models import Competency, ExamTemplate
    competencies = Competency.objects.all()

    if request.method == "POST":
        title = request.POST.get("title")
        description = request.POST.get("description")
        competency_id = request.POST.get("competency_id")
        time_limit_seconds = request.POST.get("time_limit_seconds")
        position_label = request.POST.get("position") or None
        is_active = request.POST.get("is_active") == "on"

        if not title:
            return render(request, "training/create_exam.html", {"competencies": competencies, "error": "Title is required."})

        exam = ExamTemplate.objects.create(
            title=title,
            description=description or "",
            competency_id=competency_id or None,
            time_limit_seconds=int(time_limit_seconds) if time_limit_seconds else 600,
            is_active=is_active,
            position=position_label,
            created_by=user,
        )
        return redirect("web-manage-questions", exam_id=exam.id)

    return render(request, "training/create_exam.html", {"competencies": competencies})


@login_required
def manage_exam_questions_page(request, exam_id: int):
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can manage exam questions.")

    from training.models import ExamTemplate, Question, QuestionChoice
    try:
        exam = ExamTemplate.objects.select_related("competency").get(id=exam_id)
    except ExamTemplate.DoesNotExist:
        return HttpResponseForbidden("Exam not found.")

    # Handle add question
    if request.method == "POST" and request.POST.get("form_type") == "add_question":
        text = request.POST.get("text")
        qtype = request.POST.get("type")
        order = request.POST.get("order")
        max_points = request.POST.get("max_points")
        if not text:
            # Render with error
            questions = exam.questions.all().prefetch_related("choices").order_by("order")
            return render(request, "training/manage_questions.html", {"exam": exam, "questions": questions, "error": "Question text is required."})

        Question.objects.create(
            exam=exam,
            text=text,
            type=qtype or Question.QuestionType.MCQ_SINGLE,
            order=int(order) if order else 1,
            max_points=float(max_points) if max_points else 1.0,
        )
        return redirect("web-manage-questions", exam_id=exam.id)

    # Handle add choice
    if request.method == "POST" and request.POST.get("form_type") == "add_choice":
        question_id = request.POST.get("question_id")
        text = request.POST.get("choice_text")
        is_correct = request.POST.get("is_correct") == "on"
        if question_id and text:
            try:
                q = exam.questions.get(id=question_id)
                # Prevent adding choices to text questions
                if q.type in [Question.QuestionType.SHORT_TEXT, Question.QuestionType.LONG_TEXT]:
                    questions = exam.questions.all().prefetch_related("choices").order_by("order")
                    return render(request, "training/manage_questions.html", {"exam": exam, "questions": questions, "error": "Cannot add choices to text questions."})
                QuestionChoice.objects.create(question=q, text=text, is_correct=is_correct)
            except Question.DoesNotExist:
                pass
        return redirect("web-manage-questions", exam_id=exam.id)

    questions = exam.questions.all().prefetch_related("choices").order_by("order")
    return render(request, "training/manage_questions.html", {"exam": exam, "questions": questions})


@login_required
def manager_sessions_page(request):
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can view sessions.")

    qs = ExamSession.objects.select_related("employee", "employee__position", "exam", "exam__competency")
    if user.is_manager():
        qs = qs.filter(employee__employee_branch__in=user.manager_branches.all())

    status_param = request.GET.get("status")
    branch_id = request.GET.get("branch")
    employee_id = request.GET.get("employee")
    exam_id = request.GET.get("exam")
    if status_param:
        qs = qs.filter(status=status_param)
    if branch_id:
        qs = qs.filter(employee__employee_branch_id=branch_id)
    if employee_id:
        qs = qs.filter(employee_id=employee_id)
    if exam_id:
        qs = qs.filter(exam_id=exam_id)

    sessions = list(qs.order_by("-started_at")[:200])
    for s in sessions:
        # Only compute result after grading is finalized
        if s.status == ExamSession.Status.GRADED:
            try:
                s.result_pass = (s.score is not None and s.max_score) and (float(s.score) / float(s.max_score) >= 0.9)
            except Exception:
                s.result_pass = None
        else:
            s.result_pass = None
    return render(request, "training/manager_sessions.html", {"sessions": sessions, "status_param": status_param})


@login_required
def manage_requirements_page(request):
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can manage requirements.")

    branches = Branch.objects.all() if user.is_admin() else user.manager_branches.all()
    branch_id = request.GET.get("branch") or (branches.first().id if branches else None)

    qs = PositionCompetencyRequirement.objects.select_related("position", "competency", "branch")
    if user.is_manager():
        qs = qs.filter(branch__in=user.manager_branches.all())
    if branch_id:
        qs = qs.filter(branch_id=branch_id)

    if request.method == "POST":
        form_type = request.POST.get("form_type")
        if form_type == "delete" and request.POST.get("req_id"):
            try:
                req = qs.get(id=request.POST.get("req_id"))
                req.delete()
            except PositionCompetencyRequirement.DoesNotExist:
                pass
            return redirect("web-manage-requirements")

    requirements = qs.order_by("position__name", "competency__title")
    return render(request, "training/manage_requirements.html", {"requirements": requirements, "branches": branches, "current_branch_id": int(branch_id) if branch_id else None})


@login_required
def grade_session_page(request, session_id: int):
    user = request.user
    if not (getattr(user, "is_manager", None) and user.is_manager()) and not (getattr(user, "is_admin", None) and user.is_admin()):
        return HttpResponseForbidden("Only managers/admins can grade.")

    try:
        session = ExamSession.objects.select_related("employee", "exam", "exam__competency").get(id=session_id)
    except ExamSession.DoesNotExist:
        return HttpResponseForbidden("Session not found.")

    # Branch scope check for managers
    if user.is_manager():
        emp_branch = getattr(session.employee, "employee_branch", None)
        if not emp_branch or emp_branch not in user.manager_branches.all():
            return HttpResponseForbidden("Not allowed to grade this session.")

    if request.method == "POST":
        form_type = request.POST.get("form_type")
        if form_type == "grade_answer":
            ans_id = request.POST.get("answer_id")
            points = request.POST.get("points_awarded")
            comment = request.POST.get("manager_comment", "")
            if ans_id and points is not None:
                try:
                    ans = session.answers.select_related("question").get(id=ans_id)
                    ans.points_awarded = float(points)
                    ans.manager_comment = comment
                    ans.save()
                except Exception:
                    pass
            return redirect("web-grade-session", session_id=session.id)

        if form_type == "finalize_grade":
            # Ensure all text answers are graded before finalizing
            ungraded_exists = session.answers.filter(
                question__type__in=[
                    "SHORT_TEXT",
                    "LONG_TEXT",
                    "MCQ_MULTI",
                ],
                points_awarded__isnull=True,
            ).exists()
            if ungraded_exists:
                answers = session.answers.select_related("question").prefetch_related("selected_choices").all()
                return render(request, "training/grade_session.html", {"session": session, "answers": answers, "error": "Please score all text answers before finalizing."})

            # Recompute final totals and update record using 90% threshold
            session.calculate_final_score()
            pct = (session.score / session.max_score * 100.0) if session.max_score else 0.0
            passed = pct >= 90.0

            from training.models import PositionCompetencyRequirement, EmployeeCompetencyRecord
            requirement = PositionCompetencyRequirement.objects.filter(
                position=session.employee.position,
                competency=session.exam.competency,
                branch=session.employee.employee_branch,
            ).first()
            comp = session.exam.competency
            if requirement:
                priority_points = requirement.priority_points or 0
            else:
                priority_points = comp.priority_points if (comp and comp.priority_points is not None) else 0

            record, _ = EmployeeCompetencyRecord.objects.get_or_create(
                employee=session.employee,
                competency=session.exam.competency,
            )
            record.score = session.score or 0
            if passed:
                record.status = EmployeeCompetencyRecord.Status.PASSED
                record.points_earned = priority_points
                record.date_completed = timezone.now().date()
            else:
                if record.status != EmployeeCompetencyRecord.Status.PASSED:
                    record.status = EmployeeCompetencyRecord.Status.FAILED
                record.points_earned = record.points_earned or 0
            record.save()
            return redirect("web-grade-session", session_id=session.id)

    try:
        if session.status == ExamSession.Status.GRADED:
            session.result_pass = (session.score is not None and session.max_score) and (float(session.score) / float(session.max_score) >= 0.9)
        else:
            session.result_pass = None
    except Exception:
        session.result_pass = None

    answers = session.answers.select_related("question").prefetch_related("selected_choices").all()
    return render(request, "training/grade_session.html", {"session": session, "answers": answers})


@login_required
def take_exam_page(request, exam_id: int):
    """
    Minimal page to render questions for an exam and submit answers.
    Implements the same rules as the API endpoints for starting and submitting.
    """
    user = request.user
    try:
        exam = ExamTemplate.objects.select_related("competency").get(id=exam_id, is_active=True)
    except ExamTemplate.DoesNotExist:
        return HttpResponseForbidden("Invalid exam or inactive.")

    # Employees can only access exams posted for their position and branch
    if getattr(user, "is_employee", None) and user.is_employee():
        is_allowed = PositionCompetencyRequirement.objects.filter(
            position=user.position,
            competency=exam.competency,
            branch=user.employee_branch,
        ).exists()
        if not is_allowed:
            return HttpResponseForbidden("You are not allowed to take this exam.")

        # Allow exam access without forcing course start; managers decide assignment policy.

        # Block repeat attempts once a session has been submitted/graded/expired.
        finalized = (
            ExamSession.objects.filter(exam=exam, employee=user)
            .exclude(status=ExamSession.Status.IN_PROGRESS)
            .order_by("-started_at")
            .first()
        )
        if finalized:
            return redirect("web-exam-result", session_id=finalized.id)

    # Get or create an in-progress session on GET; reuse on POST
    session = ExamSession.objects.filter(
        exam=exam,
        employee=user,
        status=ExamSession.Status.IN_PROGRESS,
    ).first()

    if request.method == "GET":
        if not session:
            session = ExamSession.objects.create(exam=exam, employee=user)

        questions = exam.questions.all().prefetch_related("choices").order_by("order")
        return render(
            request,
            "training/take_exam.html",
            {
                "exam": exam,
                "session": session,
                "questions": questions,
            },
        )

    # POST: submit answers and auto-grade objective questions
    if not session:
        return HttpResponseForbidden("No active session.")

    # Clear existing answers to support re-submit
    session.answers.all().delete()

    total_score = 0.0
    max_score = 0.0

    # Iterate through questions and read form fields
    for question in exam.questions.all().order_by("order"):
        q_field = f"q_{question.id}"
        text_field = f"q_{question.id}_text"

        ans = ExamAnswer.objects.create(
            session=session,
            question=question,
            text_answer=request.POST.get(text_field, ""),
        )

        selected_choice_ids = []
        if question.type == Question.QuestionType.MCQ_SINGLE or question.type == Question.QuestionType.TRUE_FALSE:
            value = request.POST.get(q_field)
            if value:
                selected_choice_ids = [value]
        elif question.type == Question.QuestionType.MCQ_MULTI:
            selected_choice_ids = request.POST.getlist(q_field)

        if selected_choice_ids:
            choices = QuestionChoice.objects.filter(id__in=selected_choice_ids, question=question)
            ans.selected_choices.set(choices)

        max_score += float(question.max_points)
        auto_points = ans.auto_score()
        if auto_points is not None:
            ans.points_awarded = auto_points
            ans.save()
            total_score += float(auto_points)

    # Update session state
    session.score = total_score
    session.max_score = max_score
    session.status = ExamSession.Status.SUBMITTED
    session.save()

    # Increment attempts on record for tracking
    from training.models import EmployeeCompetencyRecord
    record, _ = EmployeeCompetencyRecord.objects.get_or_create(
        employee=user,
        competency=exam.competency,
    )
    record.attempts_count = (record.attempts_count or 0) + 1
    record.save(update_fields=["attempts_count"])

    return redirect("web-exam-result", session_id=session.id)


@login_required
def exam_result_page(request, session_id: int):
    """Simple page to show submitted results for the session."""
    try:
        session = ExamSession.objects.select_related("exam", "employee").get(id=session_id, employee=request.user)
    except ExamSession.DoesNotExist:
        return HttpResponseForbidden("Session not found.")

    answers = session.answers.select_related("question").prefetch_related("selected_choices")
    return render(
        request,
        "training/exam_result.html",
        {
            "session": session,
            "answers": answers,
        },
    )


@login_required
def employee_dashboard_page(request):
    """Employee home: required competencies for their position/branch and exams to take."""
    viewer = request.user
    # Subject user: default to viewer; admins/managers can pass employee_number to peek
    subject = viewer
    emp_no = (request.GET.get("employee_number") or "").strip()
    if emp_no and (getattr(viewer, "is_admin", None) and viewer.is_admin() or getattr(viewer, "is_manager", None) and viewer.is_manager()):
        from accounts.models import User as Employee
        target = Employee.objects.filter(employee_number=emp_no).select_related("position", "employee_branch").first()
        if target:
            if getattr(viewer, "is_manager", None) and viewer.is_manager():
                # Managers may only view employees within their branches
                if target.role == Employee.Roles.EMPLOYEE and target.employee_branch_id not in set(viewer.manager_branches.values_list("id", flat=True)):
                    target = None
            if target:
                subject = target

    # Required competencies via branch+position
    pos_reqs = (
        PositionCompetencyRequirement.objects.select_related("competency", "position", "branch")
        .filter(position=subject.position, branch=subject.employee_branch)
        .order_by("competency__title")
    )

    # Additional employee-specific requirements (promotions/targeted training)
    from training.models import EmployeeCompetencyRequirement as EmpReq
    emp_reqs = (
        EmpReq.objects.select_related("competency", "branch")
        .filter(employee=subject)
        .order_by("competency__title")
    )

    # Merge with preference to employee-specific entries to avoid duplicates
    merged_by_comp = {}
    for r in emp_reqs:
        if getattr(r, "competency_id", None):
            merged_by_comp[r.competency_id] = r
    for r in pos_reqs:
        if getattr(r, "competency_id", None) and r.competency_id not in merged_by_comp:
            merged_by_comp[r.competency_id] = r
    reqs = list(merged_by_comp.values())

    # Map competency -> latest active exams
    from training.models import ExamTemplate, EmployeeCompetencyRecord

    comp_ids = [r.competency_id for r in reqs if getattr(r, "competency_id", None)]
    exams_by_comp = {}
    if comp_ids:
        for exam in ExamTemplate.objects.filter(is_active=True, competency_id__in=comp_ids).select_related("competency").order_by("-created_at"):
            exams_by_comp.setdefault(exam.competency_id, []).append(exam)

    # Records for status/score
    records = {rec.competency_id: rec for rec in EmployeeCompetencyRecord.objects.filter(employee=subject, competency_id__in=comp_ids)}

    # Recent sessions
    sessions = (
        ExamSession.objects.select_related("exam", "exam__competency")
        .filter(employee=subject)
        .order_by("-started_at")[:20]
    )

    latest_session_by_comp = {}
    for s in sessions:
        comp_id = getattr(getattr(s.exam, "competency", None), "id", None)
        if comp_id and comp_id not in latest_session_by_comp:
            latest_session_by_comp[comp_id] = s

    rows = []
    for r in reqs:
        rows.append({
            "req": r,
            "record": records.get(r.competency_id),
            "exams": exams_by_comp.get(r.competency_id, []),
            "latest_session": latest_session_by_comp.get(r.competency_id),
        })

    return render(
        request,
        "training/employee_dashboard.html",
        {"rows": rows, "sessions": sessions, "view_subject": subject, "is_impersonated": subject.id != viewer.id, "impersonated_emp_no": emp_no},
    )


@login_required
def competency_detail_page(request, comp_id: int):
    """Show competency content and allow starting course; list available exams."""
    user = request.user
    # Ensure this competency is required for the employee's position/branch
    req = PositionCompetencyRequirement.objects.select_related("competency", "branch", "position").filter(
        position=user.position,
        branch=user.employee_branch,
        competency_id=comp_id,
    ).first()
    if not req or not req.competency:
        return HttpResponseForbidden("Competency not allowed for your position/branch.")

    comp = req.competency
    from training.models import ExamTemplate, EmployeeCompetencyRecord
    exams = list(ExamTemplate.objects.filter(is_active=True, competency_id=comp.id).order_by("-created_at"))
    record, _ = EmployeeCompetencyRecord.objects.get_or_create(employee=user, competency=comp)

    latest_session = (
        ExamSession.objects.select_related("exam")
        .filter(employee=user, exam__competency=comp)
        .order_by("-started_at")
        .first()
    )

    if request.method == "POST" and request.POST.get("form_type") == "start_course":
        record.status = EmployeeCompetencyRecord.Status.IN_PROGRESS
        record.save(update_fields=["status"])
        return redirect("web-competency-detail", comp_id=comp.id)

    return render(
        request,
        "training/competency_detail.html",
        {"comp": comp, "req": req, "exams": exams, "record": record, "latest_session": latest_session},
    )


@login_required
def competency_file_action(request, comp_id: int, filetype: str, action: str):
    """Securely serve or download competency attachments for authorized employees."""
    user = request.user
    req = PositionCompetencyRequirement.objects.select_related("competency").filter(
        position=user.position,
        branch=user.employee_branch,
        competency_id=comp_id,
    ).first()
    if not req or not req.competency:
        return HttpResponseForbidden("Not allowed.")

    comp = req.competency
    field = None
    if filetype == "pdf":
        field = comp.pdf_file
    elif filetype == "image":
        field = comp.image
    else:
        raise Http404()

    if not field:
        raise Http404()

    try:
        fh = open(field.path, "rb")
    except Exception:
        raise Http404()

    as_attachment = (action == "download")
    filename = field.name.split("/")[-1]
    return FileResponse(fh, as_attachment=as_attachment, filename=filename)


class EmployeeDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Get competencies assigned to this employee's position and branch
        position_id = getattr(user, 'position_id', None)
        branch_id = getattr(user, 'employee_branch_id', None)
        reqs = PositionCompetencyRequirement.objects.filter(
            position_id=position_id,
            branch_id=branch_id
        ).select_related('competency')
        competencies = [r.competency for r in reqs]
        # For each competency, get the related exam (if any)
        data = []
        for comp in competencies:
            exam = ExamTemplate.objects.filter(competency=comp, is_active=True).first()
            data.append({
                'competency': CompetencySerializer(comp).data,
                'exam': ExamTemplateSerializer(exam).data if exam else None
            })
        return Response(data)
