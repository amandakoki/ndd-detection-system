from django.contrib import admin

from .models import Classification, Learner, ProgressEntry


class ClassificationInline(admin.TabularInline):
    model = Classification
    extra = 0


class ProgressInline(admin.TabularInline):
    model = ProgressEntry
    extra = 0


@admin.register(Learner)
class LearnerAdmin(admin.ModelAdmin):
    list_display = ("name", "educator", "created_at")
    list_filter = ("educator",)
    search_fields = ("name", "educator__email")
    inlines = [ClassificationInline, ProgressInline]