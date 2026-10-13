from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import User

SIGNUP_ROLES = [User.Role.EDUCATOR, User.Role.LEARNER, User.Role.PARENT]


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=[(r.value, r.label) for r in SIGNUP_ROLES])

    class Meta:
        model = User
        fields = ["name", "email", "password", "role"]

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        validate_password(value) 
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)