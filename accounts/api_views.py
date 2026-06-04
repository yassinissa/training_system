from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .serializers import UserSerializer

from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

class CurrentUserAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


# Profile picture upload endpoint
class ProfilePictureUploadAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user = request.user
        image = request.FILES.get('profile_picture')
        if not image:
            return Response({'detail': 'No image provided.'}, status=status.HTTP_400_BAD_REQUEST)
        user.profile_picture = image
        user.save()
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


# Profile picture remove endpoint
class ProfilePictureRemoveAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        user.profile_picture = None
        user.save()
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------
# EMPLOYEE PROFILE ATTACHMENTS API
# ---------------------------------------------------------
from django.shortcuts import get_object_or_404
from .models import EmployeeAttachment, User as UserModel
from .serializers import EmployeeAttachmentSerializer


def _can_manage_employee(actor, employee):
    """True if `actor` (the request.user) may upload to / view files on
    `employee`'s profile. Admins can manage everyone; managers only
    employees inside their own branches."""
    if not actor or not actor.is_authenticated:
        return False
    role = getattr(actor, 'role', None)
    if role == 'ADMIN' or getattr(actor, 'is_superuser', False):
        return True
    if role == 'MANAGER':
        # Manager can manage employees in any of their branches
        try:
            managed_qs = actor.managed_branches_qs()
            return (
                employee.employee_branch_id is not None
                and managed_qs.filter(id=employee.employee_branch_id).exists()
            )
        except Exception:
            # Defensive: if the helper isn't on the actor, fall back to deny.
            return False
    return False


def _detect_attachment_kind(uploaded_file):
    """Cheap MIME / extension sniff so the UI can group by kind."""
    ct = (getattr(uploaded_file, 'content_type', '') or '').lower()
    name = (getattr(uploaded_file, 'name', '') or '').lower()
    if ct.startswith('image/') or name.endswith((
        '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.heic'
    )):
        return EmployeeAttachment.Kind.PHOTO
    return EmployeeAttachment.Kind.OTHER


class EmployeeAttachmentListCreateView(APIView):
    """
    GET  /api/accounts/employees/<employee_id>/attachments/ - list files.
    POST /api/accounts/employees/<employee_id>/attachments/ - upload one
                                                              or many.
    POST accepts either a single `file` field or many `files` fields
    in the same multipart request. Optional fields: `caption`, `kind`.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, employee_id):
        employee = get_object_or_404(UserModel, pk=employee_id)
        if not _can_manage_employee(request.user, employee):
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        qs = employee.attachments.all()
        return Response(EmployeeAttachmentSerializer(qs, many=True).data)

    def post(self, request, employee_id):
        employee = get_object_or_404(UserModel, pk=employee_id)
        if not _can_manage_employee(request.user, employee):
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        files = request.FILES.getlist('files') or request.FILES.getlist('file')
        if not files:
            return Response(
                {'detail': "No file uploaded - use 'file' or 'files'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        caption = (request.data.get('caption') or '').strip()
        explicit_kind = (request.data.get('kind') or '').strip().upper() or None

        created = []
        for f in files:
            kind = explicit_kind or _detect_attachment_kind(f)
            # Validate the kind against the choices; fall back to OTHER.
            if kind not in dict(EmployeeAttachment.Kind.choices):
                kind = EmployeeAttachment.Kind.OTHER
            att = EmployeeAttachment.objects.create(
                employee=employee,
                file=f,
                kind=kind,
                caption=caption,
                uploaded_by=request.user,
            )
            created.append(att)

        return Response(
            EmployeeAttachmentSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class EmployeeAttachmentDeleteView(APIView):
    """DELETE /api/accounts/employee-attachments/<id>/ - remove one file."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        att = get_object_or_404(EmployeeAttachment, pk=pk)
        if not _can_manage_employee(request.user, att.employee):
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        # Delete the underlying file from storage too (R2 in prod).
        if att.file:
            try:
                att.file.delete(save=False)
            except Exception:
                pass
        att.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------
# NOTIFICATIONS API
# ---------------------------------------------------------
from .models import Notification
from .serializers import NotificationSerializer


class NotificationListAPIView(APIView):
    """GET /api/accounts/notifications/?unread=1 - list current user's notifications."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(user=request.user)
        if request.query_params.get('unread'):
            qs = qs.filter(is_read=False)
        # Cap to 50 most recent so we don't paginate something this small.
        qs = qs[:50]
        data = NotificationSerializer(qs, many=True).data
        unread = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'results': data, 'unread_count': unread})


class NotificationMarkReadAPIView(APIView):
    """POST /api/accounts/notifications/<id>/read/ - mark one notification as read."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            n = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        if not n.is_read:
            n.is_read = True
            n.save(update_fields=['is_read'])
        return Response(NotificationSerializer(n).data)


class NotificationMarkAllReadAPIView(APIView):
    """POST /api/accounts/notifications/read-all/ - mark every notification as read."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'updated': updated})
