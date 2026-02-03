
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import User
from .serializers import UserSerializer

class EmployeeProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, employee_id):
        # Lookup employee profile by id
        employee = get_object_or_404(User, id=employee_id, role=User.Roles.EMPLOYEE)
        return Response(UserSerializer(employee).data)

    def delete(self, request, employee_id):
        user = request.user
        employee = get_object_or_404(User, id=employee_id, role=User.Roles.EMPLOYEE)
        # Only admin or manager of the employee's branch can delete
        if user.is_admin() or (user.is_manager() and employee.employee_branch in user.manager_branches.all()):
            employee.delete()
            return Response({'message': 'Employee profile deleted.'}, status=status.HTTP_204_NO_CONTENT)
        return Response({'error': 'Not authorized to delete this employee.'}, status=status.HTTP_403_FORBIDDEN)

from rest_framework import viewsets, permissions
from .models import Position, User
from .serializers import EmployeeRegisterSerializer,ManagerRegisterSerializer,AdminRegisterSerializer, PositionSerializer,UserSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import CustomLoginSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404
from django.db.models import Q
from branches.models import Branch

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


class AdminUserListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        role = request.query_params.get("role")
        employee_number = request.query_params.get("employee_number")
        position_id = request.query_params.get("position")
        branch_id = request.query_params.get("branch")

        qs = User.objects.all()
        if role:
            qs = qs.filter(role=role)
        if employee_number:
            qs = qs.filter(employee_number=employee_number)
        if position_id:
            qs = qs.filter(position_id=position_id)
        if branch_id:
            qs = qs.filter(Q(employee_branch_id=branch_id) | Q(manager_branches__id=branch_id)).distinct()

        data = UserSerializer(qs, many=True).data
        return Response({"results": data})


class AdminUserUpdateView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        emp_no = (request.data.get("employee_number") or "").strip()
        role = (request.data.get("role") or "").strip()
        position_id = request.data.get("position_id") or None
        employee_branch_id = request.data.get("employee_branch_id") or None
        mgr_branch_ids = request.data.get("manager_branch_ids") or []

        try:
            user_to_edit = User.objects.get(employee_number=emp_no)
            valid_roles = [User.Roles.ADMIN, User.Roles.MANAGER, User.Roles.EMPLOYEE]
            if role in valid_roles:
                user_to_edit.role = role

            if position_id not in (None, ""):
                user_to_edit.position_id = int(position_id)

            if user_to_edit.role == User.Roles.EMPLOYEE:
                user_to_edit.employee_branch_id = int(employee_branch_id) if employee_branch_id not in (None, "") else None
                user_to_edit.manager_branches.clear()
            elif user_to_edit.role == User.Roles.MANAGER:
                user_to_edit.employee_branch_id = int(employee_branch_id) if employee_branch_id not in (None, "") else None
                if mgr_branch_ids:
                    ids = [int(i) for i in mgr_branch_ids if i]
                    primary_id = user_to_edit.employee_branch_id
                    if primary_id:
                        ids = [i for i in ids if i != primary_id]
                    user_to_edit.manager_branches.set(Branch.objects.filter(id__in=ids))
                else:
                    user_to_edit.manager_branches.clear()
            else:
                user_to_edit.employee_branch_id = int(employee_branch_id) if employee_branch_id not in (None, "") else None
                if mgr_branch_ids:
                    ids = [int(i) for i in mgr_branch_ids if i]
                    user_to_edit.manager_branches.set(Branch.objects.filter(id__in=ids))
                else:
                    user_to_edit.manager_branches.clear()

            user_to_edit.save()
            return Response({"message": "User updated.", "user": UserSerializer(user_to_edit).data})
        except User.DoesNotExist:
            return Response({"error": "User not found by employee number."}, status=404)
        except Exception as e:
            return Response({"error": f"Could not update user: {e}"}, status=400)