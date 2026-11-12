import logging

from django.db import transaction
from django.utils import timezone

from .models import Classification, ProgressEntry, Recommendation
from .recommendations import HOME_SUPPORT, LEARNER_CONTENT, SUPPORT

logger = logging.getLogger(__name__)

# The model's bands, mapped to the risk levels the dashboards use.
RISK_FROM_BAND = {"low": "Low", "elevated": "Medium", "high": "High"}


class ScreeningError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


def _clamp_percent(value):
    return max(0, min(100, round(float(value))))


def run_screening(learner, levels):
    """Score a game log, save the result for this learner, and return it."""
    if learner.age is None:
        raise ScreeningError("Set this learner's age before running a screening.")

    try:
        from ml.predictor import score  # loaded on first use, not at startup

        result = score(levels, learner.age)
    except ValueError as exc:
        logger.warning("Game log rejected: %s", exc)
        raise ScreeningError(
            "That game log couldn't be scored. Check that enough levels were played."
        )
    except Exception:
        logger.exception("Scoring failed")
        raise ScreeningError("Scoring isn't available right now.", 503)

    risk = RISK_FROM_BAND.get(result.get("band"))
    if risk is None:
        logger.error("Unexpected band from the model: %r", result.get("band"))
        raise ScreeningError("Scoring isn't available right now.", 503)

    probability = float(result["probability"])
    today = timezone.localdate()

    features = [
        {
            "name": d.get("label") or d.get("feature"),
            "weight": round(abs(float(d.get("shap", 0))), 3),
            "effect": d.get("effect", ""),
        }
        for d in (result.get("drivers") or [])
    ]

    accuracy = (result.get("features") or {}).get("overall_accuracy")

    with transaction.atomic():
        classification = Classification.objects.create(
            learner=learner,
            risk=risk,
            confidence=_clamp_percent(probability * 100),  # shown as "Screening score"
            probability=probability,
            classified_on=today,
            game_log=levels,
            support=SUPPORT[risk],
            home_support=HOME_SUPPORT[risk],
            features=features,
        )
        if accuracy is not None:
            ProgressEntry.objects.create(
                learner=learner,
                recorded_on=today,
                value=_clamp_percent(float(accuracy) * 100),
            )
        content = LEARNER_CONTENT.get(risk)
        if content:
            Recommendation.objects.create(learner=learner, **content)

    return classification