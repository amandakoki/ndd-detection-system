from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    LoginView,
    MeView,
    ResendVerificationView,
    SignupView,
    VerifyEmailView,
)

urlpatterns = [
    path("signup/", SignupView.as_view()),
    path("login/", LoginView.as_view()),
    path("token/refresh/", TokenRefreshView.as_view()),
    path("me/", MeView.as_view()),
    path("verify-email/", VerifyEmailView.as_view()),
    path("resend-verification/", ResendVerificationView.as_view()),
]