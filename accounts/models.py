from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Sum

from branches.models import Branch
from training.models import CompetencyLevel, EmployeeCompetencyRecord
from training.models import LevelThresholdSetting


class Position(models.Model):
    """
    Represents a job role in the company (Waiter, Busser, Chef, Manager, etc.)
    Includes a minimum required competency level for the role (CL1–CL4).
    """

    name = models.CharField(max_length=255, unique=True)

    # Minimum required competency level for this position (e.g., Waiter → CL2)
    min_required_level = models.CharField(
        max_length=3,
        choices=CompetencyLevel.choices,
        default=CompetencyLevel.CL1,
        help_text="Minimum competency level required for users in this position."
    )

    # Minimum points required to reach each competency level
    cl1_min_points = models.IntegerField(default=0)
    cl2_min_points = models.IntegerField(default=0)
    cl3_min_points = models.IntegerField(default=0)
    cl4_min_points = models.IntegerField(default=0)

    # Optional: FOH, HOH, General, Training (hidden from admin UI)
    department = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return self.name


class User(AbstractUser):
    """
    Custom user model supporting:
    - Admin, Manager, Employee roles
    - Branch assignment
    - Position assignment (FK to Position model)
    - Competency tracking via calculated points + level
    """

    class Roles(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        MANAGER = "MANAGER", "Manager"
        EMPLOYEE = "EMPLOYEE", "Employee"

    role = models.CharField(
        max_length=20,
        choices=Roles.choices,
        default=Roles.EMPLOYEE,
    )

    # Manager can belong to multiple branches
    manager_branches = models.ManyToManyField(
        Branch,
        related_name="managers",
        blank=True,
    )

    # Employee belongs to one branch
    employee_branch = models.ForeignKey(
        Branch,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="employees",
    )

    # Position is a real model, not a string
    position = models.ForeignKey(
        Position,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )

    employee_number = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
    )

    profile_picture = models.ImageField(upload_to="profile_pics/", blank=True, null=True)

    # NOTE:
    # We do NOT store current competency level or total points as fields anymore.
    # They are derived from EmployeeCompetencyRecord to avoid manual input and duplication.

    def is_admin(self):
        return self.role == self.Roles.ADMIN

    def is_manager(self):
        return self.role == self.Roles.MANAGER

    def is_employee(self):
        return self.role == self.Roles.EMPLOYEE

    def managed_branch_ids(self):
        """Branch IDs this user manages = manager_branches M2M ∪ employee_branch (primary)."""
        ids = set(self.manager_branches.values_list('id', flat=True))
        if self.employee_branch_id:
            ids.add(self.employee_branch_id)
        return ids

    def managed_branches_qs(self):
        """Branch queryset version of managed_branch_ids() for __in filters."""
        return Branch.objects.filter(id__in=self.managed_branch_ids())

    def get_total_points(self) -> int:
        """
        Total points from all PASSED competency records.
        """
        total = (
            EmployeeCompetencyRecord.objects.filter(
                employee=self,
                status="PASSED",  # adjust if you use another value
            ).aggregate(total=Sum("points_earned"))["total"]
            or 0
        )
        return total

    def get_competency_level_thresholds(self) -> dict:
        """
        Active CL1-CL4 min-points for this user.
        Per-position values take precedence; falls back to LevelThresholdSetting.
        """
        pos = getattr(self, 'position', None)
        if pos and (pos.cl1_min_points or pos.cl2_min_points or pos.cl3_min_points or pos.cl4_min_points):
            return {
                'CL1': pos.cl1_min_points or 0,
                'CL2': pos.cl2_min_points or 0,
                'CL3': pos.cl3_min_points or 0,
                'CL4': pos.cl4_min_points or 0,
                'source': 'position',
            }
        g = LevelThresholdSetting.get_solo()
        return {
            'CL1': g.cl1_min_points or 0,
            'CL2': g.cl2_min_points or 0,
            'CL3': g.cl3_min_points or 0,
            'CL4': g.cl4_min_points or 0,
            'source': 'global',
        }

    def get_competency_level(self) -> str:
        """
        Returns CL0-CL4 from total points.
        Uses per-position thresholds when set, otherwise global.
        """
        total_points = self.get_total_points()
        t = self.get_competency_level_thresholds()
        cl1, cl2, cl3, cl4 = t['CL1'], t['CL2'], t['CL3'], t['CL4']
        if cl1 == 0 and cl2 == 0 and cl3 == 0 and cl4 == 0:
            return CompetencyLevel.CL0
        if total_points >= cl4:
            return CompetencyLevel.CL4
        if total_points >= cl3:
            return CompetencyLevel.CL3
        if total_points >= cl2:
            return CompetencyLevel.CL2
        if total_points >= cl1:
            return CompetencyLevel.CL1
        return CompetencyLevel.CL0

    def __str__(self):
        return f"{self.username} ({self.role})"

# ---------------------------------------------------------
# NOTIFICATIONS
# ---------------------------------------------------------

class Notification(models.Model):
    """Simple in-app notification surfaced in the frontend bell icon."""

    class Kind(models.TextChoices):
        EXAM_GRADED       = 'EXAM_GRADED', 'Exam graded'
        EXAM_PASSED       = 'EXAM_PASSED', 'Exam passed'
        EXAM_FAILED       = 'EXAM_FAILED', 'Exam failed'
        NEW_HIRE_TASKS    = 'NEW_HIRE_TASKS', 'New hire tasks'
        PROMOTION_TASKS   = 'PROMOTION_TASKS', 'New competencies after promotion'
        COMPETENCY_EXPIRING = 'COMPETENCY_EXPIRING', 'Competency expiring soon'
        COMPETENCY_EXPIRED  = 'COMPETENCY_EXPIRED', 'Competency expired'
        GENERIC           = 'GENERIC', 'Notification'

    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    kind = models.CharField(
        max_length=20,
        choices=Kind.choices,
        default=Kind.GENERIC,
    )
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    # Optional link the frontend can navigate to when the notification is clicked.
    link = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
        ]

    def __str__(self):
        return f'[{self.kind}] {self.user_id}: {self.title}'
