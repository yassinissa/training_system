"""
Send notifications to employees about competencies that are expiring or expired.

Rules:
- ONE_TIME / NEW_HIRE / PROMOTION / OTHER -> no recurring reminder.
- YEARLY -> one year after `date_completed` the competency must be retaken.
    * 30 days before expiry -> COMPETENCY_EXPIRING reminder (once)
    * On/after expiry        -> COMPETENCY_EXPIRED reminder (once per cycle)
    * After the employee retakes (date_completed bumps forward), the next cycle
      will fire again at 30 days before / on expiry.

Run daily, e.g. via Windows Task Scheduler or cron:

    python manage.py send_competency_reminders

Optional flag:
    --window 30   how many days ahead to warn (default 30)
    --dry-run     don't write to DB
"""

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from training.models import EmployeeCompetencyRecord, Frequency
from accounts.models import Notification


class Command(BaseCommand):
    help = "Send YEARLY competency expiry reminders (expiring / expired)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--window",
            type=int,
            default=30,
            help="Days ahead of expiry to send the 'expiring soon' reminder (default 30).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would happen without writing anything.",
        )

    def handle(self, *args, **opts):
        window = max(1, int(opts["window"]))
        dry = bool(opts["dry_run"])
        today = timezone.now().date()

        qs = (
            EmployeeCompetencyRecord.objects
            .filter(
                status=EmployeeCompetencyRecord.Status.PASSED,
                competency__frequency=Frequency.YEARLY,
                date_completed__isnull=False,
            )
            .select_related("employee", "competency")
        )

        warned = 0
        expired = 0
        skipped = 0

        for rec in qs:
            expiry = rec.date_completed + timedelta(days=365)
            days_left = (expiry - today).days
            employee = rec.employee
            comp = rec.competency
            if not employee or not comp:
                continue

            cycle_anchor = rec.date_completed.isoformat()

            if days_left < 0:
                # Past expiry - send "expired" reminder once per cycle.
                already = Notification.objects.filter(
                    user=employee,
                    kind=Notification.Kind.COMPETENCY_EXPIRED,
                    body__contains=f"[cycle={cycle_anchor}]",
                ).exists()
                if already:
                    skipped += 1
                    continue
                self._maybe_create(
                    dry=dry,
                    user=employee,
                    kind=Notification.Kind.COMPETENCY_EXPIRED,
                    title=f"Yearly competency expired",
                    body=(
                        f"Your yearly competency '{comp.title}' expired on "
                        f"{expiry.isoformat()} (last passed on {rec.date_completed.isoformat()}). "
                        f"Please retake the assessment. [cycle={cycle_anchor}]"
                    ),
                    link="/",
                )
                expired += 1
            elif 0 <= days_left <= window:
                # In the warn window - send "expiring soon" once per cycle.
                already = Notification.objects.filter(
                    user=employee,
                    kind=Notification.Kind.COMPETENCY_EXPIRING,
                    body__contains=f"[cycle={cycle_anchor}]",
                ).exists()
                if already:
                    skipped += 1
                    continue
                self._maybe_create(
                    dry=dry,
                    user=employee,
                    kind=Notification.Kind.COMPETENCY_EXPIRING,
                    title=f"Yearly competency expiring soon",
                    body=(
                        f"'{comp.title}' expires in {days_left} day"
                        f"{'' if days_left == 1 else 's'} (on {expiry.isoformat()}). "
                        f"Please retake the assessment before then. [cycle={cycle_anchor}]"
                    ),
                    link="/",
                )
                warned += 1
            else:
                skipped += 1

        verb = self.style.WARNING("(dry-run)") if dry else ""
        self.stdout.write(
            f"Done {verb}. expiring={warned} expired={expired} skipped={skipped}"
        )

    def _maybe_create(self, *, dry, user, kind, title, body, link):
        if dry:
            self.stdout.write(f"  WOULD notify {user}: [{kind}] {title}")
            return
        Notification.objects.create(
            user=user,
            kind=kind,
            title=title,
            body=body,
            link=link,
        )
