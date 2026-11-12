import logging
from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.emails import send_verification_email
from accounts.models import User
from accounts.serializers import SignupSerializer
from classroom.models import Classification, Learner

from .models import AuditEvent, Level, log_event
from .permissions import IsSystemAdmin
from .serializers import LevelSerializer

logger = logging.getLogger(__name__)

PAGE_SIZE = 10
ROLES = {"educator", "learner", "parent", "admin"}


def _bad(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": message}, status=code)


def user_payload(u):
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "email_verified": u.email_verified,
        "is_active": u.is_active,
    }


def _database_ok():
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return True
    except Exception:
        return False


def _email_label():
    mailers = getattr(settings, "MAILERS", None) or {}
    backend = mailers.get("default", {}).get("BACKEND", "")
    return "Console (development)" if "console" in backend else "SMTP"


class OverviewView(APIView):
    permission_classes = [IsSystemAdmin]

    def get(self, request):
        week_ago = timezone.localdate() - timedelta(days=7)
        educators = User.objects.filter(role="educator")
        guardians = User.objects.filter(role="parent")

        db_ok = _database_ok()
        classes = educators.annotate(learner_count=Count("learners")).order_by("name")

        return Response(
            {
                "counts": {
                    "educators": {
                        "total": educators.count(),
                        "unverified": educators.filter(email_verified=False).count(),
                    },
                    "learners": {
                        "total": Learner.objects.count(),
                        "with_accounts": Learner.objects.filter(user__isnull=False).count(),
                    },
                    "guardians": {
                        "total": guardians.count(),
                        "unverified": guardians.filter(email_verified=False).count(),
                    },
                    "screenings": {
                        "total": Classification.objects.count(),
                        "last_7_days": Classification.objects.filter(
                            classified_on__gte=week_ago
                        ).count(),
                    },
                },
                "health": {
                    "api": {"ok": True, "label": "Running"},
                    "database": {
                        "ok": db_ok,
                        "label": "Connected" if db_ok else "Unavailable",
                    },
                    "email": {"ok": True, "label": _email_label()},
                },
                "classes": [
                    {"id": e.id, "name": e.name, "email": e.email, "learners": e.learner_count}
                    for e in classes
                ],
                "activity": [
                    {"id": ev.id, "text": ev.text, "when": ev.created_at.isoformat()}
                    for ev in AuditEvent.objects.all()[:8]
                ],
            }
        )


class UserListCreateView(APIView):
    permission_classes = [IsSystemAdmin]

    def get(self, request):
        qs = User.objects.all().order_by("name", "id")

        q = request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(email__icontains=q))

        role = request.query_params.get("role")
        if role in ROLES:
            qs = qs.filter(role=role)

        status_filter = request.query_params.get("status")
        if status_filter == "active":
            qs = qs.filter(is_active=True)
        elif status_filter == "inactive":
            qs = qs.filter(is_active=False)

        count = qs.count()
        pages = max(1, -(-count // PAGE_SIZE))
        try:
            page = int(request.query_params.get("page", 1))
        except ValueError:
            page = 1
        page = min(max(page, 1), pages)
        start = (page - 1) * PAGE_SIZE

        return Response(
            {
                "results": [user_payload(u) for u in qs[start:start + PAGE_SIZE]],
                "count": count,
                "page": page,
                "pages": pages,
            }
        )

    def post(self, request):
        serializer = SignupSerializer(data=request.data)  # educator, learner or parent
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        try:
            send_verification_email(user)
        except Exception:
            logger.exception("Could not send verification email")
        log_event(request.user, f"Added {user.role} account {user.email}")
        return Response(user_payload(user), status=status.HTTP_201_CREATED)


class UserActionView(APIView):
    permission_classes = [IsSystemAdmin]

    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        action = request.data.get("action")

        if action == "deactivate":
            if user.pk == request.user.pk:
                return _bad("You can't deactivate your own account.")
            other_admin = (
                User.objects.filter(role="admin", is_active=True).exclude(pk=user.pk).exists()
            )
            if user.role == "admin" and not other_admin:
                return _bad("At least one active admin account is required.")
            user.is_active = False
            user.save(update_fields=["is_active"])
            log_event(request.user, f"Deactivated {user.email}")

        elif action == "activate":
            user.is_active = True
            user.save(update_fields=["is_active"])
            log_event(request.user, f"Activated {user.email}")

        elif action == "verify":
            user.email_verified = True
            user.save(update_fields=["email_verified"])
            log_event(request.user, f"Marked {user.email} as verified")

        elif action == "resend":
            if user.email_verified:
                return _bad("This account is already verified.")
            try:
                send_verification_email(user)
            except Exception:
                logger.exception("Could not resend verification email")
                return _bad("The email couldn't be sent.", status.HTTP_502_BAD_GATEWAY)
            log_event(request.user, f"Resent verification email to {user.email}")

        else:
            return _bad("Unknown action.")

        return Response(user_payload(user))


class LevelListCreateView(APIView):
    permission_classes = [IsSystemAdmin]

    def get(self, request):
        return Response({"levels": LevelSerializer(Level.objects.all(), many=True).data})

    def post(self, request):
        serializer = LevelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        level = serializer.save()
        log_event(request.user, f"Added level \"{level.name}\"")
        return Response(LevelSerializer(level).data, status=status.HTTP_201_CREATED)


class LevelDetailView(APIView):
    permission_classes = [IsSystemAdmin]

    def patch(self, request, pk):
        level = get_object_or_404(Level, pk=pk)
        serializer = LevelSerializer(level, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        level = serializer.save()
        log_event(request.user, f"Edited level \"{level.name}\"")
        return Response(LevelSerializer(level).data)