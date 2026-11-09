from django.urls import path
from .views import ScreeningView

urlpatterns = [path("screen/", ScreeningView.as_view())]