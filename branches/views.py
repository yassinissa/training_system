from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets, permissions
from rest_framework.permissions import SAFE_METHODS
from .models import Branch
from .serializers import BranchSerializer


class BranchPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        is_authed = bool(user and user.is_authenticated)
        if request.method in SAFE_METHODS:
            return is_authed and (user.is_admin() or user.is_manager())
        return is_authed and user.is_admin()


class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [BranchPermission]
