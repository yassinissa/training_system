"""
Mark stale IN_PROGRESS exam sessions as EXPIRED.

A session is considered stale when, for the same (exam, employee) pair, a
later session already reached SUBMITTED / GRADED / EXPIRED. The new
StartExamSessionSerializer + SubmitExamView prevent this going forward, but
existing rows from before that fix still need cleaning up.

Usage:
    python manage.py clean_orphan_sessions          # dry-run
    python manage.py clean_orphan_sessions --apply  # actually update rows
"""

from django.core.management.base import BaseCommand
from training.models import ExamSession


class Command(BaseCommand):
    help = "Mark stale IN_PROGRESS exam sessions (duplicates) as EXPIRED."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Actually write changes. Without this flag, run is a dry-run.",
        )

    def handle(self, *args, **opts):
        apply = opts["apply"]
        finished_statuses = [
            ExamSession.Status.SUBMITTED,
            ExamSession.Status.GRADED,
            ExamSession.Status.EXPIRED,
        ]

        # IN_PROGRESS rows that have a sibling row at a finished status.
        in_progress = ExamSession.objects.filter(status=ExamSession.Status.IN_PROGRESS)
        orphans = []
        for s in in_progress.select_related("employee", "exam"):
            sibling_exists = ExamSession.objects.filter(
                exam_id=s.exam_id,
                employee_id=s.employee_id,
                status__in=finished_statuses,
            ).exists()
            if sibling_exists:
                orphans.append(s)

        self.stdout.write(f"Found {len(orphans)} orphan in-progress session(s).")
        for s in orphans[:50]:
            self.stdout.write(
                f"  - id={s.id} employee={s.employee} exam={s.exam}"
            )
        if len(orphans) > 50:
            self.stdout.write(f"  ... and {len(orphans) - 50} more")

        if not apply:
            self.stdout.write(
                self.style.WARNING(
                    "Dry run. Re-run with --apply to mark these as EXPIRED."
                )
            )
            return

        if not orphans:
            return

        ExamSession.objects.filter(
            pk__in=[s.pk for s in orphans]
        ).update(status=ExamSession.Status.EXPIRED)
        self.stdout.write(
            self.style.SUCCESS(f"Marked {len(orphans)} session(s) as EXPIRED.")
        )
