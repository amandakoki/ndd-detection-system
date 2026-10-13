import logging

from django.core import signing
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .emails import read_verification_token, send_verification_email
from .models import User
from .serializers import LoginSerializer, SignupSerializer

logger = logging.getLogger(__name__)


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        try:
            send_verification_email(user)
        except Exception:
            # the account exists; they can use "resend" if the email didn't go out
            logger.exception("Could not send verification email")
        return Response(
            {"detail": "Account created. Check your email to verify."},
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token", "")
        try:
            data = read_verification_token(token)
        except signing.SignatureExpired:
            return Response(
                {"detail": "This link has expired. Request a new one from the login page."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except signing.BadSignature:
            return Response(
                {"detail": "This link is invalid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(pk=data["uid"], email=data["email"])
        except User.DoesNotExist:
            return Response(
                {"detail": "This link is invalid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])
        return Response({"detail": "Email verified. You can now log in."})


class ResendVerificationView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resend"

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        user = User.objects.filter(email=email, email_verified=False).first()
        if user:
            try:
                send_verification_email(user)
            except Exception:
                logger.exception("Could not resend verification email")
        # same answer either way, so nobody can use this to find out who has an account
        return Response(
            {"detail": "If that account exists and is unverified, a new email has been sent."}
        )


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response({"id": u.id, "name": u.name, "email": u.email, "role": u.role})