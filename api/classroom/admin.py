from django.contrib import admin

from .models import (
    Activity,
    ActivityAssignment,
    Classification,
    Learner,
    ProgressEntry,
    Recommendation,
)


class ClassificationInline(admin.TabularInline):
    model = Classification
    extra = 0


class ProgressInline(admin.TabularInline):
    model = ProgressEntry
    extra = 0


class AssignmentInline(admin.TabularInline):
    model = ActivityAssignment
    extra = 0


class RecommendationInline(admin.TabularInline):
    model = Recommendation
    extra = 0


@admin.register(Learner)
class LearnerAdmin(admin.ModelAdmin):
    list_display = ("name", "educator", "user", "created_at")
    list_filter = ("educator",)
    search_fields = ("name", "educator__email")
    readonly_fields = ("learner_code", "guardian_code", "created_at")
    filter_horizontal = ("guardians",)
    inlines = [
        ClassificationInline,
        ProgressInline,
        AssignmentInline,
        RecommendationInline,
    ]


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("title", "is_active", "url")
    search_fields = ("title",)