from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from rest_framework import serializers

from .models import AGE_MAX, AGE_MIN, Activity, Learner

MIN_LEVELS = 6    # same rule as the model: fewer than 6 levels can't be scored
MAX_LEVELS = 50


class LearnerCreateSerializer(serializers.ModelSerializer):
    age = serializers.IntegerField(min_value=AGE_MIN, max_value=AGE_MAX)

    class Meta:
        model = Learner
        fields = ["name", "age"]

    def validate_name(self, value):
        value = " ".join(value.split())  # tidy up extra spaces
        if len(value) < 2:
            raise serializers.ValidationError("Enter the learner's name.")
        educator = self.context["request"].user
        if Learner.objects.filter(educator=educator, name__iexact=value).exists():
            raise serializers.ValidationError(
                "You already have a learner with this name."
            )
        return value


class LevelResultSerializer(serializers.Serializer):
    clicks = serializers.IntegerField(min_value=1, max_value=500)
    hits = serializers.IntegerField(min_value=0, max_value=500)
    misses = serializers.IntegerField(min_value=0, max_value=500)

    def validate(self, attrs):
        if attrs["hits"] > attrs["clicks"] or attrs["misses"] > attrs["clicks"]:
            raise serializers.ValidationError(
                "Hits and misses can't be more than clicks."
            )
        return attrs


class ScreeningSerializer(serializers.Serializer):
    levels = LevelResultSerializer(many=True)
    # optional: the assignment this game session belongs to
    assignment = serializers.IntegerField(required=False)

    def validate_levels(self, value):
        if len(value) < MIN_LEVELS:
            raise serializers.ValidationError(
                "At least " + str(MIN_LEVELS) + " levels are needed to score a child."
            )
        if len(value) > MAX_LEVELS:
            raise serializers.ValidationError(
                "No more than " + str(MAX_LEVELS) + " levels can be submitted at once."
            )
        return value


class ActivityCreateSerializer(serializers.Serializer):
    """An educator creates an activity: the built-in game, or a link to other content."""

    title = serializers.CharField(max_length=150)
    description = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    kind = serializers.ChoiceField(choices=["game", "link"])
    url = serializers.CharField(required=False, allow_blank=True, max_length=200)

    def validate_title(self, value):
        value = " ".join(value.split())
        if len(value) < 2:
            raise serializers.ValidationError("Enter a title for the activity.")
        educator = self.context["request"].user
        if Activity.objects.filter(created_by=educator, title__iexact=value).exists():
            raise serializers.ValidationError("You already have an activity with this title.")
        return value

    def validate(self, attrs):
        if attrs["kind"] == "link":
            url = (attrs.get("url") or "").strip()
            if not url:
                raise serializers.ValidationError({"url": "Enter the link to the content."})
            try:
                URLValidator(schemes=["http", "https"])(url)
            except DjangoValidationError:
                raise serializers.ValidationError(
                    {"url": "Enter a full web address, starting with http:// or https://."}
                )
            attrs["url"] = url
        return attrs