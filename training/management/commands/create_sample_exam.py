from django.core.management.base import BaseCommand
from training.models import ExamTemplate, Question, QuestionChoice

class Command(BaseCommand):
    help = 'Create sample exam with MCQ, True/False, and text questions.'

    def handle(self, *args, **kwargs):
        exam, _ = ExamTemplate.objects.get_or_create(title='Sample Exam', defaults={'description': 'Demo exam for testing.'})

        # MCQ question
        q1, _ = Question.objects.get_or_create(
            exam=exam,
            order=1,
            defaults={
                'text': 'What is the capital of France?',
                'type': Question.QuestionType.MCQ_SINGLE,
                'max_points': 1,
            }
        )
        QuestionChoice.objects.get_or_create(question=q1, text='Paris', is_correct=True)
        QuestionChoice.objects.get_or_create(question=q1, text='London', is_correct=False)
        QuestionChoice.objects.get_or_create(question=q1, text='Berlin', is_correct=False)
        QuestionChoice.objects.get_or_create(question=q1, text='Madrid', is_correct=False)

        # True/False question
        q2, _ = Question.objects.get_or_create(
            exam=exam,
            order=2,
            defaults={
                'text': 'The sky is blue.',
                'type': Question.QuestionType.TRUE_FALSE,
                'max_points': 1,
            }
        )
        QuestionChoice.objects.get_or_create(question=q2, text='True', is_correct=True)
        QuestionChoice.objects.get_or_create(question=q2, text='False', is_correct=False)

        # Short text question
        q3, _ = Question.objects.get_or_create(
            exam=exam,
            order=3,
            defaults={
                'text': 'Name a programming language that starts with P.',
                'type': Question.QuestionType.SHORT_TEXT,
                'max_points': 1,
            }
        )

        # Long text question
        q4, _ = Question.objects.get_or_create(
            exam=exam,
            order=4,
            defaults={
                'text': 'Describe your experience with Django.',
                'type': Question.QuestionType.LONG_TEXT,
                'max_points': 2,
            }
        )

        self.stdout.write(self.style.SUCCESS('Sample exam and questions created.'))
