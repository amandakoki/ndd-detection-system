from django.db.models import Max
from rest_framework import serializers

from .models import Level


def _clean(values):
    seen, out = set(), []
    for v in values:
        v = " ".join(str(v).split())
        if v and v.lower() not in seen:
            seen.add(v.lower())
            out.append(v)
    return out


def _items(correct, other):
    return [{"text": t, "correct": True} for t in correct] + [
        {"text": t, "correct": False} for t in other
    ]


class LevelSerializer(serializers.ModelSerializer):
    correct_items = serializers.ListField(
        child=serializers.CharField(max_length=40), write_only=True
    )
    other_items = serializers.ListField(
        child=serializers.CharField(max_length=40), write_only=True
    )

    class Meta:
        model = Level
        fields = [
            "id", "name", "skill", "difficulty", "order", "is_active",
            "prompt", "correct_items", "other_items",
        ]
        extra_kwargs = {"order": {"required": False}}

    def validate_correct_items(self, value):
        return _clean(value)

    def validate_other_items(self, value):
        return _clean(value)

    def validate(self, attrs):
        current = (self.instance.items if self.instance else []) or []
        correct = attrs.get(
            "correct_items", [i["text"] for i in current if i.get("correct")]
        )
        other = attrs.get(
            "other_items", [i["text"] for i in current if not i.get("correct")]
        )
        if not correct:
            raise serializers.ValidationError({"correct_items": "Add at least one correct answer."})
        if not other:
            raise serializers.ValidationError({"other_items": "Add at least one incorrect choice."})
        if len(correct) + len(other) > 12:
            raise serializers.ValidationError({"other_items": "Use at most 12 choices in total."})
        if {c.lower() for c in correct} & {o.lower() for o in other}:
            raise serializers.ValidationError(
                {"other_items": "A choice can't be both correct and incorrect."}
            )
        return attrs

    def create(self, validated_data):
        correct = validated_data.pop("correct_items")
        other = validated_data.pop("other_items")
        validated_data["items"] = _items(correct, other)
        if "order" not in validated_data:
            validated_data["order"] = (
                Level.objects.aggregate(m=Max("order"))["m"] or 0
            ) + 1
        return super().create(validated_data)

    def update(self, instance, validated_data):
        correct = validated_data.pop("correct_items", None)
        other = validated_data.pop("other_items", None)
        if correct is not None or other is not None:
            current = instance.items or []
            if correct is None:
                correct = [i["text"] for i in current if i.get("correct")]
            if other is None:
                other = [i["text"] for i in current if not i.get("correct")]
            validated_data["items"] = _items(correct, other)
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        items = instance.items or []
        data["correct_items"] = [i["text"] for i in items if i.get("correct")]
        data["other_items"] = [i["text"] for i in items if not i.get("correct")]
        return data