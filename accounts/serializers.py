from rest_framework import serializers
from accounts.models import User, Position
from branches.models import Branch
from django.contrib.auth import authenticate


# ---------------------------------------------------------
# POSITION SERIALIZER
# ---------------------------------------------------------

class PositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = [
            "id",
            "name",
            "department",
            "cl1_min_points",
            "cl2_min_points",
            "cl3_min_points",
            "cl4_min_points",
        ]


# ---------------------------------------------------------
# USER SERIALIZER (READ)
# ---------------------------------------------------------

class UserSerializer(serializers.ModelSerializer):
    position = PositionSerializer(read_only=True)
    employee_branch = serializers.StringRelatedField()
    manager_branches = serializers.StringRelatedField(many=True)
    current_competency_level = serializers.SerializerMethodField()
    total_competency_points = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "role",
            "employee_number",
            "position",
            "employee_branch",
            "manager_branches",
            "current_competency_level",
            "total_competency_points",
        ]

    def get_current_competency_level(self, obj):
        return obj.get_competency_level()

    def get_total_competency_points(self, obj):
        return obj.get_total_points()


# ---------------------------------------------------------
# USER REGISTRATION SERIALIZERS
# ---------------------------------------------------------

class AdminRegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username", "password", "role"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class ManagerRegisterSerializer(serializers.ModelSerializer):
    manager_branches = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        many=True
    )

    class Meta:
        model = User
        fields = [
            "username",
            "password",
            "role",
            "employee_number",
            "position",
            "manager_branches",
        ]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        branches = validated_data.pop("manager_branches", [])
        user = User.objects.create_user(**validated_data)
        user.manager_branches.set(branches)
        return user


class EmployeeRegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "username",
            "password",
            "employee_number",
            "position",
            "employee_branch",
        ]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


# ---------------------------------------------------------
# CUSTOM LOGIN SERIALIZER
# ---------------------------------------------------------

from rest_framework import serializers
from django.contrib.auth import authenticate
from accounts.models import User


class CustomLoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=False)
    employee_number = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        username = attrs.get("username")
        employee_number = attrs.get("employee_number")
        password = attrs.get("password")

        # Admin login → username required
        if username:
            user = authenticate(username=username, password=password)
            if not user:
                raise serializers.ValidationError("Invalid username or password")
            return {"user": user}

        # Employee/Manager login → employee_number required
        if employee_number:
            try:
                user_obj = User.objects.get(employee_number=employee_number)
            except User.DoesNotExist:
                raise serializers.ValidationError("Invalid employee number")

            user = authenticate(username=user_obj.username, password=password)
            if not user:
                raise serializers.ValidationError("Invalid employee number or password")

            return {"user": user}

        raise serializers.ValidationError("Provide either username or employee_number")

