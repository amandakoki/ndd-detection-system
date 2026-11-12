from rest_framework import serializers

from .models import AGE_MAX, AGE_MIN, Learner

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