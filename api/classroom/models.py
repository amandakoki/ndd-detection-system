import secrets

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no look-alike characters
AGE_MIN = 4   # adjust to match the ages in your training data
AGE_MAX = 18


def generate_code():
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))


class Learner(models.Model):
    educator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learners",
        limit_choices_to={"role": "educator"},
    )
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    # the learner's own account, once they connect with their code
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="learner_profile",
        limit_choices_to={"role": "learner"},
    )
    # parent accounts connected to this learner
    guardians = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="children",
        limit_choices_to={"role": "parent"},
    )
    learner_code = models.CharField(max_length=8, unique=True, null=True, blank=True, editable=False)
    guardian_code = models.CharField(max_length=8, unique=True, null=True, blank=True, editable=False)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["educator", "name"],
                name="unique_learner_name_per_educator",
            )
        ]

    def save(self, *args, **kwargs):
        if not self.learner_code:
            self.learner_code = generate_code()
        if not self.guardian_code:
            self.guardian_code = generate_code()
        super().save(*args, **kwargs)

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
        help_text='Recommendations for the educator, e.g. ["Extended time on written tasks"]',
    )
    home_support = models.JSONField(
        default=list,
        blank=True,
        help_text='Suggestions for the guardian, e.g. ["Read together with audio support"]',
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


class Activity(models.Model):
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    url = models.URLField(
        blank=True,
        help_text="Where the activity opens. Leave blank if it isn't available yet.",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "activities"

    def __str__(self):
        return self.title


class ActivityAssignment(models.Model):
    learner = models.ForeignKey(
        Learner, on_delete=models.CASCADE, related_name="assignments"
    )
    activity = models.ForeignKey(
        Activity, on_delete=models.CASCADE, related_name="assignments"
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["assigned_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["learner", "activity"],
                name="unique_activity_per_learner",
            )
        ]

    def __str__(self):
        return f"{self.learner} - {self.activity}"


class Recommendation(models.Model):
    learner = models.ForeignKey(
        Learner, on_delete=models.CASCADE, related_name="recommendations"
    )
    title = models.CharField(max_length=150)
    reason = models.TextField(blank=True)
    url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.learner} - {self.title}"