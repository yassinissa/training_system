from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Branches + Employees
from branches.views import BranchViewSet
from accounts.views import (
    AdminRegisterViewSet,
    ManagerRegisterViewSet,
    EmployeeRegisterViewSet,
    CustomLoginView,
    PositionViewSet, 
    PromoteEmployeeView,
)
from accounts.auth_views import RefreshView
from accounts.views import PositionViewSet
# Router
router = DefaultRouter()

# Branch endpoints
router.register(r'branches', BranchViewSet, basename='branches')
router.register(r'positions', PositionViewSet, basename='positions')

# Registration endpoints
router.register("register/admin", AdminRegisterViewSet, basename="register-admin")
router.register("register/manager", ManagerRegisterViewSet, basename="register-manager")
router.register("register/employee", EmployeeRegisterViewSet, basename="register-employee")


urlpatterns = [
    # Django admin
    path('admin/', admin.site.urls),

    # Router-based endpoints (branches + registration)
    path('api/', include(router.urls)),
    # v1 alias for frontend convenience
    path('api/v1/', include(router.urls)),

    # Authentication
    path("api/auth/login/", CustomLoginView.as_view(), name="custom-login"),
    path("api/auth/refresh/", RefreshView.as_view(), name="token_refresh"),
    path("api/accounts/promote/", PromoteEmployeeView.as_view(), name="promote-employee"),
    # v1 aliases
    path("api/v1/auth/login/", CustomLoginView.as_view()),
    path("api/v1/auth/refresh/", RefreshView.as_view()),
    path("api/v1/accounts/promote/", PromoteEmployeeView.as_view()),

    # Training system (competencies, exams, sessions, etc.)
    path("api/training/", include("training.urls")),
    path("api/v1/training/", include("training.urls")),

    # Simple frontend pages (temporary)
    path("web/exams/", include("training.web_urls")),

    # Session-based authentication (login/logout/password views)
    path("accounts/", include("django.contrib.auth.urls")),
]


# Static files (for development)
from django.conf import settings
from django.conf.urls.static import static

urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
