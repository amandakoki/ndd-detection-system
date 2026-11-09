from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from classroom.models import Classification, Learner

from .predictor import score

RISK_MAP = {
    "low": Classification.Risk.LOW,
    "elevated": Classification.Risk.MEDIUM,
    "high": Classification.Risk.HIGH,
}

SUPPORT = {
    "low": (
        ["Continue regular literacy activities", "Re-screen if concerns arise"],
        ["Keep up regular reading together"],
    ),
    "elevated": (
        ["Extended time on written tasks", "Monitor reading and spelling progress",
         "Consider a follow-up screening"],
        ["Read together with audio support", "Short, frequent practice sessions"],
    ),
    "high": (
        ["Recommend a formal assessment by a specialist", "Extended time on written tasks",
         "Provide audio support and larger text"],
        ["Talk to the school about a formal assessment", "Read together with audio support"],
    ),
}


def _valid_log(levels):
    if not isinstance(levels, list):
        return False
    for lv in levels:
        if not isinstance(lv, dict):
            return False
        for key in ("clicks", "hits", "misses"):
            v = lv.get(key)
            if not isinstance(v, int) or isinstance(v, bool) or v < 0:
                return False
    return True


class ScreeningView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        role = getattr(request.user, "role", None)

        if role == "learner":
            learner = getattr(request.user, "learner_profile", None)
            if learner is None:
                return Response({"detail": "No learner profile linked."}, status=403)
        elif role == "educator":
            try:
                learner = Learner.objects.get(
                    pk=request.data.get("learner_id"), educator=request.user
                )
            except (Learner.DoesNotExist, ValueError, TypeError):
                return Response({"detail": "Learner not found."}, status=404)
        else:
            return Response({"detail": "Not allowed."}, status=403)

        levels = request.data.get("levels")
        age = request.data.get("age")
        if not _valid_log(levels):
            return Response({"detail": "levels must be a list of {clicks, hits, misses}."}, status=400)
        if not isinstance(age, (int, float)) or not 3 <= age <= 18:
            return Response({"detail": "age must be a number between 3 and 18."}, status=400)

        try:
            result = score(levels, age)
        except ValueError as e:  # e.g. too few levels
            return Response({"detail": str(e)}, status=400)
        except FileNotFoundError:
            return Response({"detail": "Screening model unavailable."}, status=503)

        band = result["band"]
        support, home_support = SUPPORT[band]
        c = Classification.objects.create(
            learner=learner,
            risk=RISK_MAP[band],
            confidence=round(result["probability"] * 100),
            support=support,
            home_support=home_support,
            features=[
                {"name": d["label"], "weight": abs(d["shap"]), "effect": d["effect"]}
                for d in result["drivers"]
            ],
        )

        # Children only get an acknowledgement; educators see the result.
        if role == "learner":
            return Response({"saved": True}, status=status.HTTP_201_CREATED)
        return Response(
            {
                "id": c.id,
                "learner": learner.id,
                "risk": c.risk,
                "flagged": result["flagged"],
                "probability": result["probability"],
                "classified_on": c.classified_on,
            },
            status=status.HTTP_201_CREATED,
        )