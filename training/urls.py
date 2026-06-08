from django.urls import path, include
from training.manual_award_views import (
    ManualAwardListCreateView,
    ManualAwardPendingListView,
    ManualAwardApproveView,
    ManualAwardRejectView,
)
from training.exam_assignment_views import (
    ExamAssignmentListCreateView,
    ExamAssignmentDetailView,
    MyExamAssignmentsView,
    ExamAssignmentCancelView,
)
from training.views import (
    CompetencyListCreateView,
    CompetencyDetailView,
    CompetencyAttachmentListCreateView,
    CompetencyAttachmentDeleteView,
    PositionCompetencyRequirementCreateView,
    PositionCompetencyRequirementListView,
    PositionCompetencyRequirementDetailView,
    MyCompetenciesView,
    ExamTemplateCreateView,
    ExamTemplateListView,
    ExamTemplateDetailView,
    ExamTemplateSetActiveView,
    QuestionListCreateView,
    QuestionChoiceListCreateView,
    StartExamSessionView,
    MyExamSessionsView,
    ManagerExamSessionsView,
    ManagerExamSessionDetailView,
    ManagerGradingQueueView,
    SubmitExamView,
    GradeExamView,
    GradeAnswerView,
    AllowRetakeView,
    CompetencyRecordListView,
    PublishRequirementsView,
    DashboardSummaryView,
    NonComplianceReportView,
    EmployeeActivityView,
    LevelThresholdsView,
    EmployeeRequirementView,
    ExpiringCompetenciesView,
    EmployeeDashboardAPIView,
    LevelDeficientReportView,
)

urlpatterns = [
    # Competencies (list/create + retrieve/update/delete)
    path('competencies/', CompetencyListCreateView.as_view(), name='competency-list'),
    path('competencies/<int:pk>/', CompetencyDetailView.as_view(), name='competency-detail'),

    # Manual competency awards (verbal assessments, admin-approved)
    path('manual-awards/', ManualAwardListCreateView.as_view(), name='manual-awards'),
    path('manual-awards/pending/', ManualAwardPendingListView.as_view(), name='manual-awards-pending'),
    path('manual-awards/<int:pk>/approve/', ManualAwardApproveView.as_view(), name='manual-awards-approve'),
    path('manual-awards/<int:pk>/reject/', ManualAwardRejectView.as_view(), name='manual-awards-reject'),

    # Per-employee exam assignments
    path('exam-assignments/', ExamAssignmentListCreateView.as_view(), name='exam-assignments'),
    path('exam-assignments/mine/', MyExamAssignmentsView.as_view(), name='exam-assignments-mine'),
    path('exam-assignments/<int:pk>/', ExamAssignmentDetailView.as_view(), name='exam-assignment-detail'),
    path('exam-assignments/<int:pk>/cancel/', ExamAssignmentCancelView.as_view(), name='exam-assignment-cancel'),
    # Multi-file attachments per competency (gallery support)
    path('competencies/<int:pk>/attachments/', CompetencyAttachmentListCreateView.as_view(), name='competency-attachments'),
    path('attachments/<int:pk>/', CompetencyAttachmentDeleteView.as_view(), name='competency-attachment-delete'),

    # ---------------------------------------------------------
    # POSITION → COMPETENCY REQUIREMENTS
    # ---------------------------------------------------------
    path("position-requirements/", PositionCompetencyRequirementCreateView.as_view(), name="position-competency-create"),
    path("position-requirements/list/", PositionCompetencyRequirementListView.as_view(), name="position-competency-list"),
    path("position-requirements/<int:pk>/", PositionCompetencyRequirementDetailView.as_view(), name="position-competency-detail"),

    # ---------------------------------------------------------
    # EMPLOYEE COMPETENCY PROGRESS
    # ---------------------------------------------------------
    path("my-competencies/", MyCompetenciesView.as_view(), name="my-competencies"),

    # ---------------------------------------------------------
    # EXAM TEMPLATES
    # ---------------------------------------------------------
    path("exams/", ExamTemplateCreateView.as_view(), name="exam-template-create"),
    path("exams/list/", ExamTemplateListView.as_view(), name="exam-template-list"),
    path("exams/<int:pk>/", ExamTemplateDetailView.as_view(), name="exam-template-detail"),
    path("exams/<int:pk>/set-active/", ExamTemplateSetActiveView.as_view(), name="exam-template-set-active"),

    # ---------------------------------------------------------
    # QUESTIONS + CHOICES
    # ---------------------------------------------------------
    path("questions/", QuestionListCreateView.as_view(), name="question-list-create"),
    path("choices/", QuestionChoiceListCreateView.as_view(), name="choice-list-create"),

    # ---------------------------------------------------------
    # EXAM SESSIONS
    # ---------------------------------------------------------
    path("exam/start/", StartExamSessionView.as_view(), name="start-exam"),
    path("exam/sessions/", MyExamSessionsView.as_view(), name="my-exam-sessions"),
    path("exam/sessions/manage/", ManagerExamSessionsView.as_view(), name="manage-exam-sessions"),
    path("exam/sessions/<int:pk>/", ManagerExamSessionDetailView.as_view(), name="manage-exam-session-detail"),
    path("exam/grading-queue/", ManagerGradingQueueView.as_view(), name="manage-exam-grading-queue"),

    # ---------------------------------------------------------
    # SUBMIT EXAM + AUTO-GRADE
    # ---------------------------------------------------------
    path("exam/submit/", SubmitExamView.as_view(), name="submit-exam"),
    path("exam/answer/grade/", GradeAnswerView.as_view(), name="grade-answer"),
    path("requirements/publish/", PublishRequirementsView.as_view(), name="publish-requirements"),
    path("employee/requirements/", EmployeeRequirementView.as_view(), name="employee-requirements"),
    path("expiring/", ExpiringCompetenciesView.as_view(), name="expiring-competencies"),
    path("dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("compliance/missing/", NonComplianceReportView.as_view(), name="non-compliance-report"),
    path("employee/activity/", EmployeeActivityView.as_view(), name="employee-activity"),
    # Global level thresholds
    path("levels/thresholds/", LevelThresholdsView.as_view(), name="levels-thresholds"),

    # ---------------------------------------------------------
    # MANUAL GRADING
    # ---------------------------------------------------------
    path("exam/grade/<int:session_id>/", GradeExamView.as_view(), name="grade-exam"),
    path("exam/sessions/<int:session_id>/allow-retake/", AllowRetakeView.as_view(), name="allow-exam-retake"),
    path("records/", CompetencyRecordListView.as_view(), name="competency-records"),

    # ---------------------------------------------------------
    # EMPLOYEE DASHBOARD
    # ---------------------------------------------------------
    path("employee/dashboard/", EmployeeDashboardAPIView.as_view(), name="employee-dashboard-api"),

    path('reports/level-deficient/', LevelDeficientReportView.as_view(), name='level-deficient-report'),
]
