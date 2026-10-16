from django.urls import path

from .views import EducatorDashboardView, LearnerCreateView

urlpatterns = [
    path("dashboard/", EducatorDashboardView.as_view()),
    path("learners/", LearnerCreateView.as_view()),
]