from rest_framework import serializers

from .models import Learner


class LearnerCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Learner
        fields = ["name"]

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