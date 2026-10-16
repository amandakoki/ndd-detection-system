from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Classification, Learner
from .permissions import IsEducator
from .serializers import LearnerCreateSerializer

# Which risk levels count as "flagged" in the class list. Change here if needed.
FLAGGED_RISKS = {Classification.Risk.HIGH, Classification.Risk.MEDIUM}


def learner_payload(learner):
    classifications = sorted(
        learner.classifications.all(),
        key=lambda c: (c.classified_on, c.id),
        reverse=True,
    )
    latest = classifications[0] if classifications else None
    progress = sorted(
        learner.progress_entries.all(), key=lambda p: (p.recorded_on, p.id)
    )[-12:]  # the most recent 12 entries

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
        "progress": [
            {"label": p.recorded_on.strftime("%d %b"), "value": p.value}
            for p in progress
        ],
    }


class EducatorDashboardView(APIView):
    permission_classes = [IsEducator]

    def get(self, request):
        learners = (
            Learner.objects.filter(educator=request.user)  # only their own class
            .prefetch_related("classifications", "progress_entries")
            .order_by("name")
        )
        return Response({"learners": [learner_payload(l) for l in learners]})


class LearnerCreateView(APIView):
    permission_classes = [IsEducator]

    def post(self, request):
        serializer = LearnerCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        learner = serializer.save(educator=request.user)
        return Response(learner_payload(learner), status=status.HTTP_201_CREATED)