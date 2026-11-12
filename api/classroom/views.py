from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Activity, Classification, Learner
from .permissions import IsEducator, IsGuardian, IsLearner
from .screening import ScreeningError, run_screening
from .serializers import (
    ActivityCreateSerializer,
    LearnerCreateSerializer,
    ScreeningSerializer,
)

# Which risk levels count as "flagged" in the educator's class list.
FLAGGED_RISKS = {Classification.Risk.HIGH, Classification.Risk.MEDIUM}

# Where the built-in Letter Matching game lives in the app.
GAME_URL = "/learner/play"


def latest_classification(learner):
    items = sorted(
        learner.classifications.all(),
        key=lambda c: (c.classified_on, c.id),
        reverse=True,
    )
    return items[0] if items else None


def progress_points(learner):
    entries = sorted(
        learner.progress_entries.all(), key=lambda p: (p.recorded_on, p.id)
    )[-12:]  # the most recent 12
    return [
        {"label": p.recorded_on.strftime("%d %b"), "value": p.value}
        for p in entries
    ]


def _weight(feature):
    try:
        return abs(float(feature.get("weight", 0)))
    except (TypeError, ValueError):
        return 0.0


def educator_activities(user):
    """Activities an educator can see and assign: their own, plus any shared ones."""
    return Activity.objects.filter(is_active=True).filter(
        Q(created_by=user) | Q(created_by__isnull=True)
    )


def activity_payload(activity):
    return {
        "id": activity.id,
        "title": activity.title,
        "description": activity.description,
    }


# ---------------------------------------------------------------- educator
def learner_payload(learner):
    latest = latest_classification(learner)
    return {
        "id": learner.id,
        "name": learner.name,
        "flagged": bool(latest and latest.risk in FLAGGED_RISKS),
        "classification": None
        if latest is None
        else {
            "risk": latest.risk,
            "confidence": latest.confidence,
            "classified_on": latest.classified_on.isoformat(),
            "support": latest.support,
            "features": latest.features,
        },
        "progress": progress_points(learner),
        "assignments": [
            {
                "id": a.id,
                "activity_id": a.activity_id,
                "title": a.activity.title,
                "assigned_at": a.assigned_at.isoformat(),
                "completed_at": a.completed_at.isoformat()
                if a.completed_at
                else None,
            }
            for a in learner.assignments.all()
        ],
        "learner_code": learner.learner_code,
        "guardian_code": learner.guardian_code,
        "learner_linked": learner.user_id is not None,
        "guardian_count": len(learner.guardians.all()),
    }


class EducatorDashboardView(APIView):
    permission_classes = [IsEducator]

    def get(self, request):
        learners = (
            Learner.objects.filter(educator=request.user)  # only their own class
            .prefetch_related(
                "classifications",
                "progress_entries",
                "guardians",
                "assignments__activity",
            )
            .order_by("name")
        )
        activities = educator_activities(request.user).order_by("title")
        return Response(
            {
                "learners": [learner_payload(l) for l in learners],
                "activities": [activity_payload(a) for a in activities],
            }
        )


class LearnerCreateView(APIView):
    permission_classes = [IsEducator]

    def post(self, request):
        serializer = LearnerCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        learner = serializer.save(educator=request.user)
        return Response(learner_payload(learner), status=status.HTTP_201_CREATED)


class EducatorActivityView(APIView):
    """An educator creates an activity of their own."""

    permission_classes = [IsEducator]

    def post(self, request):
        serializer = ActivityCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        url = GAME_URL if data["kind"] == "game" else data["url"]
        activity = Activity.objects.create(
            title=data["title"],
            description=data.get("description", ""),
            url=url,
            created_by=request.user,
        )
        return Response(activity_payload(activity), status=status.HTTP_201_CREATED)


class AssignActivityView(APIView):
    """An educator assigns one of their activities to one of their own learners."""

    permission_classes = [IsEducator]

    def post(self, request, pk):
        learner = get_object_or_404(Learner, pk=pk, educator=request.user)
        try:
            activity_id = int(request.data.get("activity"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Choose an activity to assign."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        activity = get_object_or_404(educator_activities(request.user), pk=activity_id)

        assignment, created = learner.assignments.get_or_create(activity=activity)
        if not created and assignment.completed_at is not None:
            # assigning it again lets the learner play it again
            assignment.completed_at = None
            assignment.save(update_fields=["completed_at"])

        return Response(
            learner_payload(learner),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


# ---------------------------------------------------------------- guardian
def child_payload(learner):
    latest = latest_classification(learner)
    classification = None
    if latest is not None:
        features = [
            f
            for f in (latest.features or [])
            if isinstance(f, dict) and f.get("name")
        ]
        features.sort(key=_weight, reverse=True)
        classification = {
            "risk": latest.risk,
            "confidence": latest.confidence,
            "classified_on": latest.classified_on.isoformat(),
            "factors": [f["name"] for f in features[:3]],
            "home_support": latest.home_support,
        }
    return {
        "id": learner.id,
        "name": learner.name,
        "classification": classification,
        "progress": progress_points(learner),
    }


class GuardianDashboardView(APIView):
    permission_classes = [IsGuardian]

    def get(self, request):
        children = (
            Learner.objects.filter(guardians=request.user)  # only their own children
            .prefetch_related("classifications", "progress_entries")
            .order_by("name")
        )
        return Response({"children": [child_payload(c) for c in children]})


# ----------------------------------------------------------------- learner
class LearnerDashboardView(APIView):
    permission_classes = [IsLearner]

    def get(self, request):
        learner = Learner.objects.filter(user=request.user).first()
        if learner is None:
            return Response(
                {"learner": None, "activities": [], "recommendation": None}
            )

        assignments = learner.assignments.select_related("activity").filter(
            activity__is_active=True
        )
        recommendation = learner.recommendations.first()  # newest first

        return Response(
            {
                "learner": {"id": learner.id, "name": learner.name},
                "activities": [
                    {
                        "id": a.id,
                        "title": a.activity.title,
                        "description": a.activity.description,
                        "url": a.activity.url,
                        "completed_at": a.completed_at.isoformat()
                        if a.completed_at
                        else None,
                    }
                    for a in assignments
                ],
                "recommendation": None
                if recommendation is None
                else {
                    "title": recommendation.title,
                    "reason": recommendation.reason,
                    "url": recommendation.url,
                },
            }
        )


# ------------------------------------------------- connecting with a code
class LinkAccountView(APIView):
    """A learner or guardian enters the code their educator gave them."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "link"

    def post(self, request):
        code = "".join(str(request.data.get("code", "")).split())
        code = code.replace("-", "").upper()
        user = request.user

        if not code:
            return Response(
                {"detail": "Enter a code."}, status=status.HTTP_400_BAD_REQUEST
            )

        if user.role == "learner":
            if Learner.objects.filter(user=user).exists():
                return Response(
                    {"detail": "Your account is already connected."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            with transaction.atomic():
                learner = (
                    Learner.objects.select_for_update()
                    .filter(learner_code=code)
                    .first()
                )
                if learner is None or learner.user_id is not None:
                    return Response(
                        {"detail": "That code isn't valid or has already been used."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                learner.user = user
                learner.save(update_fields=["user"])
            return Response({"detail": "Connected."})

        if user.role == "parent":
            learner = Learner.objects.filter(guardian_code=code).first()
            if learner is None:
                return Response(
                    {"detail": "That code isn't valid."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            learner.guardians.add(user)
            return Response({"detail": "Connected."})

        return Response(
            {"detail": "Only learner and guardian accounts can use a code."},
            status=status.HTTP_403_FORBIDDEN,
        )


# ------------------------------------------------------------- screenings
class LearnerScreeningView(APIView):
    """A learner's own game session sends its log here.
    The child never sees the result, only a confirmation."""

    permission_classes = [IsLearner]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "screening"

    def post(self, request):
        learner = Learner.objects.filter(user=request.user).first()
        if learner is None:
            return Response(
                {"detail": "Your account isn't connected to a learner yet."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ScreeningSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        levels = [dict(level) for level in serializer.validated_data["levels"]]
        try:
            run_screening(learner, levels)
        except ScreeningError as exc:
            return Response({"detail": str(exc)}, status=exc.status_code)

        # mark the assignment this session belonged to as completed
        assignment_id = serializer.validated_data.get("assignment")
        if assignment_id:
            learner.assignments.filter(
                pk=assignment_id, completed_at__isnull=True
            ).update(completed_at=timezone.now())

        return Response({"detail": "Screening saved."}, status=status.HTTP_201_CREATED)


class EducatorScreeningView(APIView):
    """An educator submits a game log for one of their own learners."""

    permission_classes = [IsEducator]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "screening"

    def post(self, request, pk):
        learner = get_object_or_404(Learner, pk=pk, educator=request.user)
        serializer = ScreeningSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        levels = [dict(level) for level in serializer.validated_data["levels"]]
        try:
            run_screening(learner, levels)
        except ScreeningError as exc:
            return Response({"detail": str(exc)}, status=exc.status_code)
        return Response(learner_payload(learner), status=status.HTTP_201_CREATED)


# ------------------------------------------------------------- game levels
class GameLevelsView(APIView):
    """Active levels from the admin's learning library, for the game."""

    def get_permissions(self):
        return [IsAuthenticated()]

    def get(self, request):
        from adminpanel.models import Level

        if getattr(request.user, "role", None) not in ("learner", "educator"):
            return Response({"detail": "Not allowed."}, status=403)

        levels = []
        for lv in Level.objects.filter(is_active=True):
            items = lv.items or []
            levels.append(
                {
                    "id": lv.id,
                    "prompt": lv.prompt,
                    "correct_items": [i["text"] for i in items if i.get("correct")],
                    "other_items": [i["text"] for i in items if not i.get("correct")],
                }
            )
        return Response({"levels": levels})