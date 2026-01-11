
from rest_framework import viewsets, permissions
from .models import Position, User
from .serializers import EmployeeRegisterSerializer,ManagerRegisterSerializer,AdminRegisterSerializer, PositionSerializer,UserSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import CustomLoginSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404

class IsManagerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user.is_authenticated and 
            (user.is_manager() or user.is_admin())
        )




class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin()


class AdminRegisterViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(role=User.Roles.ADMIN)
    serializer_class = AdminRegisterSerializer
    permission_classes = [IsAdmin]  # only admins can create admins


class ManagerRegisterViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(role=User.Roles.MANAGER)
    serializer_class = ManagerRegisterSerializer
    permission_classes = [IsAdmin]  # only admins can create managers


class EmployeeRegisterViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(role=User.Roles.EMPLOYEE)
    serializer_class = EmployeeRegisterSerializer
    permission_classes = [IsManagerOrAdmin]  # managers & admins can create employees

    def get_queryset(self):
        base_qs = User.objects.filter(role=User.Roles.EMPLOYEE)
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return base_qs.none()

        if user.is_admin():
            return base_qs

        if user.is_manager():
            return base_qs.filter(employee_branch__in=user.manager_branches.all())

        return base_qs.none()

    def perform_create(self, serializer):
        # Force role to EMPLOYEE regardless of input
        user = self.request.user
        if user.is_manager():
            # Managers can only assign employees to their own branches
            employee_branch = serializer.validated_data.get("employee_branch")
            if not employee_branch or employee_branch not in user.manager_branches.all():
                raise ValueError("Managers can only assign employees to their own branches.")
        serializer.save(role=User.Roles.EMPLOYEE)



class CustomLoginView(APIView):
    authentication_classes = []   # ← REQUIRED
    permission_classes = []       # ← REQUIRED

    def post(self, request):
        serializer = CustomLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]

        refresh = RefreshToken.for_user(user)
        access = str(refresh.access_token)

        return Response({
            "access": access,
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        })

class PositionViewSet(viewsets.ModelViewSet):
     """ Full CRUD for Position (Waiter, Chef, Manager, etc.) """ 
     queryset = Position.objects.all() 
     serializer_class = PositionSerializer
     permission_classes = [permissions.IsAuthenticated]


class PromoteEmployeeView(APIView):
    permission_classes = [IsManagerOrAdmin]

    def post(self, request):
        employee_id = request.data.get("employee_id")
        new_position_id = request.data.get("position_id")
        if not employee_id or not new_position_id:
            return Response({"error": "employee_id and position_id are required"}, status=400)

        employee = get_object_or_404(User, id=employee_id, role=User.Roles.EMPLOYEE)
        new_position = get_object_or_404(Position, id=new_position_id)

        # Managers can only promote employees in their branches
        user = request.user
        if user.is_manager():
            if not employee.employee_branch or employee.employee_branch not in user.manager_branches.all():
                return Response({"error": "Not allowed to promote this employee"}, status=403)

        employee.position = new_position
        employee.save(update_fields=["position"])

        return Response({
            "message": "Employee promoted",
            "employee": UserSerializer(employee).data,
            "new_level": employee.get_competency_level(),
        })