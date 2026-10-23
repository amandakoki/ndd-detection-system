from rest_framework.permissions import BasePermission


class RolePermission(BasePermission):
    """Only logged-in users with one specific role."""

    role = None

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == self.role)


class IsEducator(RolePermission):
    role = "educator"


class IsGuardian(RolePermission):
    role = "parent"


class IsLearner(RolePermission):
    role = "learner"