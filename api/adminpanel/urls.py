from django.urls import path

from .views import (
    LevelDetailView,
    LevelListCreateView,
    OverviewView,
    UserActionView,
    UserListCreateView,
)

urlpatterns = [
    path("overview/", OverviewView.as_view()),
    path("users/", UserListCreateView.as_view()),
    path("users/<int:pk>/action/", UserActionView.as_view()),
    path("levels/", LevelListCreateView.as_view()),
    path("levels/<int:pk>/", LevelDetailView.as_view()),
]