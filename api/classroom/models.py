from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class Learner(models.Model):
    educator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learners",
        limit_choices_to={"role": "educator"},
    )
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["educator", "name"],
                name="unique_learner_name_per_educator",
            )
        ]

    def __str__(self):
        return self.name


class Classification(models.Model):
    class Risk(models.TextChoices):
        HIGH = "High", "High"
        MEDIUM = "Medium", "Medium"
        LOW = "Low", "Low"

    learner = models.ForeignKey(
        Learner, on_delete=models.CASCADE, related_name="classifications"
    )
    risk = models.CharField(max_length=10, choices=Risk.choices)
    confidence = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Percentage, 0 to 100",
    )
    classified_on = models.DateField(default=timezone.localdate)
    support = models.JSONField(
        default=list,
        blank=True,
        help_text='List of text recommendations, e.g. ["Extended time on written tasks"]',
    )
    features = models.JSONField(
        default=list,
        blank=True,
        help_text='Top features, e.g. [{"name": "Reading fluency", "weight": 0.42}]',
    )

    class Meta:
        ordering = ["-classified_on", "-id"]

    def __str__(self):
        return f"{self.learner} - {self.risk} ({self.classified_on})"


class ProgressEntry(models.Model):
    learner = models.ForeignKey(
        Learner, on_delete=models.CASCADE, related_name="progress_entries"
    )
    recorded_on = models.DateField(default=timezone.localdate)
    value = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Progress score, 0 to 100",
    )

    class Meta:
        ordering = ["recorded_on", "id"]
        verbose_name_plural = "progress entries"

    def __str__(self):
        return f"{self.learner} - {self.value} ({self.recorded_on})"