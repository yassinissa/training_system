from django.core.management.base import BaseCommand
from training.models import Question, QuestionChoice

class Command(BaseCommand):
    help = 'Check for MCQ/TrueFalse questions missing choices.'

    def handle(self, *args, **options):
        missing = []
        for q in Question.objects.filter(type__in=[
            'MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'
        ]):
            if not q.choices.exists():
                missing.append(q)
        if missing:
            self.stdout.write(self.style.WARNING('Questions missing choices:'))
            for q in missing:
                self.stdout.write(f"ID: {q.id}, Exam: {q.exam.title}, Text: {q.text}, Type: {q.type}")
        else:
            self.stdout.write(self.style.SUCCESS('All MCQ/TrueFalse questions have choices.'))
