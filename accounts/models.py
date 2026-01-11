from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Sum

from branches.models import Branch
from training.models import CompetencyLevel, EmployeeCompetencyRecord


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

    # NOTE:
    # We do NOT store current competency level or total points as fields anymore.
    # They are derived from EmployeeCompetencyRecord to avoid manual input and duplication.

    def is_admin(self):
        return self.role == self.Roles.ADMIN

    def is_manager(self):
        return self.role == self.Roles.MANAGER

    def is_employee(self):
        return self.role == self.Roles.EMPLOYEE

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

    def get_competency_level(self) -> str:
        """
        Returns CL0–CL4 based on the user's position thresholds and total points.
        Uses training.models.CompetencyLevel choices.
        If the user has no position, returns CL0.
        """
        if not self.position:
            return CompetencyLevel.CL0

        total_points = self.get_total_points()
        pos = self.position

        # Safeguard: treat None as 0
        cl1 = pos.cl1_min_points or 0
        cl2 = pos.cl2_min_points or 0
        cl3 = pos.cl3_min_points or 0
        cl4 = pos.cl4_min_points or 0

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
