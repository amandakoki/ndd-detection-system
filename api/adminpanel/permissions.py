from classroom.permissions import RolePermission


class IsSystemAdmin(RolePermission):
    role = "admin"