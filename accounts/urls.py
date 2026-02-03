from django.urls import path
from .api_views import CurrentUserAPIView, ProfilePictureUploadAPIView, ProfilePictureRemoveAPIView
from .views import EmployeeProfileView

urlpatterns = [
    path('me/', CurrentUserAPIView.as_view(), name='accounts-me'),
    path('me/profile-picture/', ProfilePictureUploadAPIView.as_view(), name='accounts-profile-picture-upload'),
    path('me/profile-picture/remove/', ProfilePictureRemoveAPIView.as_view(), name='accounts-profile-picture-remove'),
    path('employee/<int:employee_id>/', EmployeeProfileView.as_view(), name='employee-profile'),
]
