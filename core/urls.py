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
router.register(r'branches', BranchViewSet, basename='branches')
router.register(r'positions', PositionViewSet, basename='positions')
router.register("register/admin", AdminRegisterViewSet, basename="register-admin")
router.register("register/manager", ManagerRegisterViewSet, basename="register-manager")
router.register("register/employee", EmployeeRegisterViewSet, basename="register-employee")


urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/', include(router.urls)),
    path('api/v1/', include(router.urls)),

    path("api/auth/login/", CustomLoginView.as_view(), name="custom-login"),
    path("api/auth/refresh/", RefreshView.as_view(), name="token_refresh"),
    path("api/accounts/promote/", PromoteEmployeeView.as_view(), name="promote-employee"),
    path("api/accounts/admin/users/", AdminUserListView.as_view(), name="admin-user-list"),
    path("api/accounts/admin/users/update/", AdminUserUpdateView.as_view(), name="admin-user-update"),
    path("api/v1/auth/login/", CustomLoginView.as_view()),
    path("api/v1/auth/refresh/", RefreshView.as_view()),
    path("api/v1/accounts/promote/", PromoteEmployeeView.as_view()),

    path("api/accounts/", include("accounts.urls")),
    path("api/training/", include("training.urls")),
    path("api/v1/training/", include("training.urls")),

    path("accounts/", include("django.contrib.auth.urls")),
]


# Static / media files. WhiteNoise middleware serves /static/ in prod. We
# also add an explicit URL fallback for /media/ so uploaded competency
# images and PDFs render on Render's free tier (no S3 yet). Note: on
# free Render, the disk is ephemeral - uploads disappear on every redeploy.
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve as static_serve
from django.urls import re_path

urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Always-on /media/ fallback (also works when DEBUG=False).
urlpatterns += [
    re_path(
        r"^media/(?P<path>.*)$",
        static_serve,
        {"document_root": settings.MEDIA_ROOT},
        name="media-serve-prod",
    ),
]


# -----------------------------------------------------------------------------
# SPA CATCH-ALL
# Serve the React index.html for any non-API, non-admin URL so that deep
# links like /admin/reports or /exam/review/42 reload correctly when the
# browser hits the server directly.
# -----------------------------------------------------------------------------
from django.views.generic import TemplateView

INDEX_TEMPLATE = "index.html"

class SpaIndexView(TemplateView):
    template_name = INDEX_TEMPLATE

# Any path that is NOT api/, /admin/, /accounts/, /static/, /media/ falls through.
urlpatterns += [
    re_path(r"^(?!api/|admin/|accounts/|static/|media/).*$",
            SpaIndexView.as_view(), name="spa-index"),
]
