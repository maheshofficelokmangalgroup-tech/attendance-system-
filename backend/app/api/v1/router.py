"""API v1 router — mount all sub-routers here."""
from fastapi import APIRouter

from app.api.v1 import auth, employees, companies, holidays, leave_types, settings, attendance, leaves, reports, notifications

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(employees.router)
api_router.include_router(companies.router)
api_router.include_router(holidays.router)
api_router.include_router(leave_types.router)
api_router.include_router(settings.router)
api_router.include_router(attendance.router)
api_router.include_router(leaves.router)
api_router.include_router(reports.router)
api_router.include_router(notifications.router)
