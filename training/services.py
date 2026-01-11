from django.utils import timezone

from .models import (
	EmployeeCompetencyRecord,
)


def update_competency_after_exam(session):
	"""
	Update employee competency progress after an exam submission.

	- Finds the related TrainingModule via the session's exam.
	- Creates/updates EmployeeCompetencyRecord with status, best score, points, and metadata.
	"""
	# Link ExamTemplate -> TrainingModule via OneToOne related_name="module"
	module = getattr(session.exam, "module", None)
	if module is None:
		return  # No module associated; nothing to update

	# Compute percentage (guard against division by zero)
	score = session.score or 0
	max_score = session.max_score or 0
	pct = (score / max_score * 100) if max_score else 0

	passed = pct >= 60

	record, created = EmployeeCompetencyRecord.objects.get_or_create(
		employee=session.employee,
		module=module,
		defaults={
			"status": EmployeeCompetencyRecord.Status.PASSED if passed else EmployeeCompetencyRecord.Status.FAILED,
			"best_score": pct,
			"points_earned": module.base_priority_points if passed else 0,
			"last_taken_at": timezone.now(),
			"attempts_count": 1,
		},
	)

	if not created:
		# Update attempts and last taken time
		record.attempts_count = (record.attempts_count or 0) + 1
		record.last_taken_at = timezone.now()

		# Keep the best score
		if pct > float(record.best_score):
			record.best_score = pct

		# Update status and points on pass
		if passed:
			record.status = EmployeeCompetencyRecord.Status.PASSED
			record.points_earned = max(record.points_earned or 0, module.base_priority_points)
		else:
			# Only set to FAILED if never passed before
			if record.status != EmployeeCompetencyRecord.Status.PASSED:
				record.status = EmployeeCompetencyRecord.Status.FAILED

		record.save()

	# No return value needed; side-effects persisted
