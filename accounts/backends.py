from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model


class EmployeeNumberOrUsernameBackend(ModelBackend):
    """
    Authentication backend that allows logging in with either
    employee_number (for managers/employees) or username (for admins).
    Keeps default permission checks via ModelBackend.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        User = get_user_model()
        if not username or not password:
            return None

        user = None
        # Try employee_number first
        try:
            user = User.objects.get(employee_number=username)
        except User.DoesNotExist:
            # Fallback to username
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return None

        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
