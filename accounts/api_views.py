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
