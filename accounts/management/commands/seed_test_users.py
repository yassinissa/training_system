from django.core.management.base import BaseCommand
from accounts.models import User, Position
from branches.models import Branch


class Command(BaseCommand):
    help = "Seed test users: admin1, mgr1 (M001), emp1 (E001) with default position and branch"

    def handle(self, *args, **options):
        pos, _ = Position.objects.get_or_create(name='Waiter')
        branch, _ = Branch.objects.get_or_create(name='Main', defaults={'location': 'HQ'})

        admin, ca = User.objects.get_or_create(
            username='admin1',
            defaults={'role': User.Roles.ADMIN}
        )
        if ca:
            admin.set_password('adminpass')
            admin.save()
        self.stdout.write(self.style.SUCCESS(f"Admin: {admin.username}"))

        mgr, cm = User.objects.get_or_create(
            username='mgr1',
            defaults={'role': User.Roles.MANAGER, 'employee_number': 'M001', 'position': pos}
        )
        if cm:
            mgr.set_password('mgrpass')
            mgr.save()
            mgr.manager_branches.add(branch)
        self.stdout.write(self.style.SUCCESS(f"Manager: {mgr.username} ({mgr.employee_number})"))

        emp, ce = User.objects.get_or_create(
            username='emp1',
            defaults={'role': User.Roles.EMPLOYEE, 'employee_number': 'E001', 'position': pos, 'employee_branch': branch}
        )
        if ce:
            emp.set_password('emppass')
            emp.save()
        self.stdout.write(self.style.SUCCESS(f"Employee: {emp.username} ({emp.employee_number})"))
