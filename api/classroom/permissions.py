from rest_framework.permissions import BasePermission


class IsEducator(BasePermission):
    """Only logged-in users whose role is 'educator'."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == "educator")