from django.conf import settings
from django.core import signing
from django.core.mail import send_mail

SALT = "email-verification"


def make_verification_token(user):
    return signing.dumps({"uid": user.pk, "email": user.email}, salt=SALT)


def read_verification_token(token):
    return signing.loads(
        token, salt=SALT, max_age=settings.EMAIL_VERIFICATION_MAX_AGE
    )


def send_verification_email(user):
    token = make_verification_token(user)
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    send_mail(
        subject="Verify your email",
        message=(
            f"Hi {user.name},\n\n"
            f"Please confirm your email address by opening this link:\n{link}\n\n"
            "The link expires in 24 hours. If you didn't sign up, you can ignore this email."
        ),
        from_email=None,  # uses DEFAULT_FROM_EMAIL
        recipient_list=[user.email],
    )