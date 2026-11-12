from django.contrib import admin

from .models import AuditEvent, Level


@admin.register(Level)
class LevelAdmin(admin.ModelAdmin):
    list_display = ("order", "name", "skill", "difficulty", "is_active")
    ordering = ("order", "id")


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "text")