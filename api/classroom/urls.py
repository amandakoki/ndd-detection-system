from django.urls import path

from .views import (
    AssignActivityView,
    EducatorDashboardView,
    EducatorScreeningView,
    GameLevelsView,
    GuardianDashboardView,
    LearnerCreateView,
    LearnerDashboardView,
    LearnerScreeningView,
    LinkAccountView,
)

urlpatterns = [
    path("educator/dashboard/", EducatorDashboardView.as_view()),
    path("educator/learners/", LearnerCreateView.as_view()),
    path("educator/learners/<int:pk>/screenings/", EducatorScreeningView.as_view()),
    path("educator/learners/<int:pk>/assignments/", AssignActivityView.as_view()),
    path("guardian/dashboard/", GuardianDashboardView.as_view()),
    path("learner/dashboard/", LearnerDashboardView.as_view()),
    path("learner/screenings/", LearnerScreeningView.as_view()),
    path("game/levels/", GameLevelsView.as_view()),
    path("link/", LinkAccountView.as_view()),
]