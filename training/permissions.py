from rest_framework.permissions import BasePermission
from accounts.models import User

class CanManageModules(BasePermission):
    def has_permission(self, request, view):
        if request.method == "GET":
            return True
        return request.user.role in [User.Roles.ADMIN, User.Roles.MANAGER]
class CanManageExams(BasePermission):
    def has_permission(self, request, view):
        if request.method == "GET":
            return True
        return request.user.role in [User.Roles.ADMIN, User.Roles.MANAGER]
class CanManageQuestions(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in [User.Roles.ADMIN, User.Roles.MANAGER]
