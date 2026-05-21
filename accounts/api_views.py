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
