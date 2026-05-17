# This module previously contained update_competency_after_exam() which
# referenced an old TrainingModule schema (module, best_score, last_taken_at).
# The data model has since been refactored to use Competency and
# EmployeeCompetencyRecord (see training/models.py). The grading flow now lives
# in training.views.GradeExamView / SubmitExamView.
#
# Left empty intentionally - kept as a placeholder so existing imports (if any)
# do not break. Delete this file once you're sure nothing imports it.
