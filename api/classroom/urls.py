from django.urls import path

from .views import (
    EducatorDashboardView,
    GuardianDashboardView,
    LearnerCreateView,
    LearnerDashboardView,
    LinkAccountView,
)

urlpatterns = [
    path("educator/dashboard/", EducatorDashboardView.as_view()),
    path("educator/learners/", LearnerCreateView.as_view()),
    path("guardian/dashboard/", GuardianDashboardView.as_view()),
    path("learner/dashboard/", LearnerDashboardView.as_view()),
    path("link/", LinkAccountView.as_view()),
]