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
    AdminUserListView,
    AdminUserUpdateView,
)
from accounts.auth_views import RefreshView
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
    path("api/accounts/admin/users/", AdminUserListView.as_view(), name="admin-user-list"),
    path("api/accounts/admin/users/update/", AdminUserUpdateView.as_view(), name="admin-user-update"),
    # v1 aliases
    path("api/v1/auth/login/", CustomLoginView.as_view()),
    path("api/v1/auth/refresh/", RefreshView.as_view()),
    path("api/v1/accounts/promote/", PromoteEmployeeView.as_view()),


    # Accounts API (profile, etc.)
    path("api/accounts/", include("accounts.urls")),

    # Training system (competencies, exams, sessions, etc.)
    path("api/training/", include("training.urls")),
    path("api/v1/training/", include("training.urls")),

    # Session-based authentication (login/logout/password views)
    path("accounts/", include("django.contrib.auth.urls")),
]


# Static / media files (for development; in prod Whitenoise serves /static/).
from django.conf import settings
from django.conf.urls.static import static

urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


# -----------------------------------------------------------------------------
# SPA CATCH-ALL
# Serve the React index.html for any non-API, non-admin URL so that deep
# links like /admin/reports or /exam/review/42 reload correctly when the
# browser hits the server directly.
# -----------------------------------------------------------------------------
from django.urls import re_path
from django.views.generic import TemplateView

INDEX_TEMPLATE = "index.html"

class SpaIndexView(TemplateView):
    template_name = INDEX_TEMPLATE

# Any path that is NOT api/, /admin/, /accounts/, /static/, /media/ falls through.
urlpatterns += [
    re_path(r"^(?!api/|admin/|accounts/|static/|media/).*$",
            SpaIndexView.as_view(), name="spa-index"),
]
