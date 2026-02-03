from django.core.management.base import BaseCommand
from training.models import ExamTemplate, Competency, PositionCompetencyRequirement

class Command(BaseCommand):
    help = 'List all competencies, their required status, and any active exams linked to them.'

    def handle(self, *args, **options):
        print('\n--- COMPETENCIES & EXAMS ---')
        for comp in Competency.objects.all():
            print(f"Competency ID: {comp.id}, Title: {comp.title}, Requires Exam: {comp.requires_exam}")
            active_exams = ExamTemplate.objects.filter(competency=comp, is_active=True)
            if active_exams.exists():
                for exam in active_exams:
                    print(f"    Exam ID: {exam.id}, Title: {exam.title}, Active: {exam.is_active}")
            else:
                print("    No active exam linked.")
            reqs = PositionCompetencyRequirement.objects.filter(competency=comp)
            if reqs.exists():
                for req in reqs:
                    print(f"    Required for Position: {req.position_id}, Branch: {req.branch_id}")
            else:
                print("    Not required for any position/branch.")
        print('--- END ---\n')
