from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/sysadmin/", include("adminpanel.urls")),
    path("api/", include("classroom.urls")),
]