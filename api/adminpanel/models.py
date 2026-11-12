from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Level(models.Model):
    """One level of the screening game, shown to learners in play order."""

    name = models.CharField(max_length=100)
    skill = models.CharField(max_length=100, help_text="e.g. Letter recognition")
    difficulty = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="1 (easiest) to 5 (hardest)",
    )
    order = models.PositiveIntegerField(default=0, help_text="Play order, lowest first")
    is_active = models.BooleanField(default=True)
    prompt = models.CharField(max_length=200, help_text="What the child is asked to do")
    items = models.JSONField(
        default=list,
        blank=True,
        help_text='Choices shown to the child, e.g. [{"text": "b", "correct": true}]',
    )

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.name


class AuditEvent(models.Model):
    """A short line in the admin's activity log. Never put child results in here."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    text = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.text


def log_event(actor, text):
    AuditEvent.objects.create(
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        text=text[:255],
    )