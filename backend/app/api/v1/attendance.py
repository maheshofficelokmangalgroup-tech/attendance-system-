"""Attendance API router — /api/v1/attendance"""
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import get_current_user, get_current_active_employee, require_permission
from app.models.user import User
from app.models.attendance import AttendanceStatusEnum
from app.services.attendance_service import AttendanceService
from app.utils.image import validate_image_upload
from app.schemas.attendance import (
    AttendanceResponse, AttendanceTodaySummary, CheckInMetaData,
    CheckOutMetaData, RegularizeAttendanceRequest,
)
from app.schemas.common import APIResponse, PaginatedResponse

router = APIRouter(prefix="/attendance", tags=["Attendance Engine"])


def _get_client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else request.client.host if request.client else None


@router.post(
    "/check-in",
    response_model=APIResponse[AttendanceResponse],
    summary="Employee Check-In (Selfie photo + GPS + Device Info)",
)
async def check_in(
    request: Request,
    latitude: float = Form(..., ge=-90.0, le=90.0),
    longitude: float = Form(..., ge=-180.0, le=180.0),
    gps_accuracy: float = Form(..., ge=0.0),
    device_id: Optional[str] = Form(None),
    device_model: Optional[str] = Form(None),
    os_version: Optional[str] = Form(None),
    app_version: Optional[str] = Form(None),
    connection_type: Optional[str] = Form(None),
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_active_employee),
    db: Session = Depends(get_db),
):
    # Validate image upload
    validate_image_upload(photo)

    meta = CheckInMetaData(
        latitude=latitude,
        longitude=longitude,
        gps_accuracy=gps_accuracy,
        device_id=device_id,
        device_model=device_model,
        os_version=os_version,
        app_version=app_version,
        connection_type=connection_type,
    )

    svc = AttendanceService(db)
    result = svc.process_check_in(
        employee_id=current_user.employee_id,
        meta=meta,
        photo_file=photo.file,
        filename=photo.filename or "selfie.jpg",
        ip_address=_get_client_ip(request),
    )
    return APIResponse(data=result, message="Checked in successfully")


@router.post(
    "/check-out",
    response_model=APIResponse[AttendanceResponse],
    summary="Employee Check-Out (Selfie photo + GPS)",
)
async def check_out(
    request: Request,
    latitude: float = Form(..., ge=-90.0, le=90.0),
    longitude: float = Form(..., ge=-180.0, le=180.0),
    gps_accuracy: float = Form(..., ge=0.0),
    device_id: Optional[str] = Form(None),
    device_model: Optional[str] = Form(None),
    os_version: Optional[str] = Form(None),
    app_version: Optional[str] = Form(None),
    connection_type: Optional[str] = Form(None),
    task_summary: Optional[str] = Form(None),
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_active_employee),
    db: Session = Depends(get_db),
):
    validate_image_upload(photo)

    meta = CheckOutMetaData(
        latitude=latitude,
        longitude=longitude,
        gps_accuracy=gps_accuracy,
        device_id=device_id,
        device_model=device_model,
        os_version=os_version,
        app_version=app_version,
        connection_type=connection_type,
        task_summary=task_summary,
    )

    svc = AttendanceService(db)
    result = svc.process_check_out(
        employee_id=current_user.employee_id,
        meta=meta,
        photo_file=photo.file,
        filename=photo.filename or "checkout.jpg",
        ip_address=_get_client_ip(request),
    )
    return APIResponse(data=result, message="Checked out successfully")


@router.get(
    "/my-history",
    response_model=PaginatedResponse[AttendanceResponse],
    summary="Get logged-in employee's attendance history",
)
def my_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    current_user: User = Depends(get_current_active_employee),
    db: Session = Depends(get_db),
):
    svc = AttendanceService(db)
    return svc.get_my_history(employee_id=current_user.employee_id, page=page, page_size=page_size)


@router.get(
    "/today-summary",
    response_model=APIResponse[AttendanceTodaySummary],
    summary="Get today's attendance KPI breakdown",
)
def today_summary(
    company_id: int = Query(default=1),
    current_user: User = Depends(require_permission("view", "attendance")),
    db: Session = Depends(get_db),
):
    svc = AttendanceService(db)
    return APIResponse(data=svc.get_today_summary(company_id=company_id))


@router.get(
    "",
    response_model=PaginatedResponse[AttendanceResponse],
    summary="List all attendance records (Admin/Manager view)",
)
def list_attendance(
    company_id: int = Query(...),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    employee_id: Optional[int] = Query(default=None),
    department_id: Optional[int] = Query(default=None),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    status_filter: Optional[AttendanceStatusEnum] = Query(default=None, alias="status"),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(require_permission("view", "attendance")),
    db: Session = Depends(get_db),
):
    svc = AttendanceService(db)
    return svc.list_attendance(
        company_id=company_id,
        page=page,
        page_size=page_size,
        employee_id=employee_id,
        department_id=department_id,
        from_date=from_date,
        to_date=to_date,
        status_filter=status_filter,
        search=search,
    )


@router.get(
    "/{attendance_id}",
    response_model=APIResponse[AttendanceResponse],
    summary="Get attendance detail with telemetry device logs",
)
def get_attendance_detail(
    attendance_id: int,
    current_user: User = Depends(require_permission("view", "attendance")),
    db: Session = Depends(get_db),
):
    # Plain employees only get "view attendance" for their own records — admins/HR/
    # managers have broader visibility, so only scope the lookup for employees.
    role_slug = current_user.role.slug if current_user.role else ""
    requesting_employee_id = current_user.employee_id if role_slug == "employee" else None

    svc = AttendanceService(db)
    return APIResponse(data=svc.get_detail(attendance_id, requesting_employee_id=requesting_employee_id))


@router.post(
    "/{attendance_id}/regularize",
    response_model=APIResponse[AttendanceResponse],
    summary="Regularize / override attendance status",
)
def regularize_attendance(
    attendance_id: int,
    payload: RegularizeAttendanceRequest,
    current_user: User = Depends(require_permission("manage", "attendance")),
    db: Session = Depends(get_db),
):
    svc = AttendanceService(db)
    return APIResponse(data=svc.regularize(attendance_id, payload, actor_id=current_user.id))
