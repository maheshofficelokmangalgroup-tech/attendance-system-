"""
Attendance Service — Check-In, Check-Out, Status Engine, Regularization.
"""
from __future__ import annotations
import math
from datetime import date, datetime, time, timedelta, timezone
from typing import BinaryIO, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.attendance import Attendance, AttendanceDeviceLog, AttendanceStatusEnum, DeviceActionEnum
from app.models.employee import Employee
from app.models.company import Shift, AttendanceRules
from app.models.leave import Holiday
from app.repository.attendance_repo import AttendanceRepository
from app.repository.employee_repo import EmployeeRepository
from app.repository.company_repo import AttendanceRulesRepository, ShiftRepository
from app.repository.audit_repo import AuditRepository
from app.services.storage_service import get_storage_service
from app.utils.geo import validate_gps_accuracy, validate_geofence, build_google_maps_url, reverse_geocode_sync
from app.utils.image import validate_image_upload, generate_unique_filename
from app.utils.timezone import now_ist, today_ist
from app.schemas.attendance import (
    CheckInMetaData, CheckOutMetaData, AttendanceResponse,
    AttendanceTodaySummary, RegularizeAttendanceRequest,
)
from app.schemas.common import PaginatedResponse


class AttendanceService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AttendanceRepository(db)
        self.employee_repo = EmployeeRepository(db)
        self.rules_repo = AttendanceRulesRepository(db)
        self.shift_repo = ShiftRepository(db)
        self.audit_repo = AuditRepository(db)
        self.storage = get_storage_service()

    # ------------------------------------------------------------------
    # Check-In
    # ------------------------------------------------------------------

    def process_check_in(
        self,
        employee_id: int,
        meta: CheckInMetaData,
        photo_file: BinaryIO,
        filename: str,
        ip_address: Optional[str] = None,
    ) -> AttendanceResponse:
        today = today_ist()
        now = now_ist()
        current_time = now.time()

        employee = self.employee_repo.get(employee_id)
        if not employee or not employee.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found or inactive")

        # 1. Fetch Company Attendance Rules
        rules = self.rules_repo.get_by_company(employee.company_id)
        max_gps_accuracy = 50.0  # default 50 meters
        grace_period_mins = 15

        if rules:
            grace_period_mins = rules.grace_period_minutes

        # 2. Validate GPS accuracy threshold
        if not validate_gps_accuracy(meta.gps_accuracy, max_allowed_meters=max_gps_accuracy):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"GPS accuracy ({meta.gps_accuracy:.1f}m) is lower than required threshold ({max_gps_accuracy:.1f}m). Please move to an open area with clear sky view and retry.",
            )

        # 2b. Validate employee is physically within the office geofence
        # (skipped automatically if the company hasn't configured office coordinates)
        company = employee.company
        within_geofence, distance = validate_geofence(
            meta.latitude, meta.longitude,
            company.office_latitude if company else None,
            company.office_longitude if company else None,
            company.geofence_radius_meters if company else None,
        )
        if not within_geofence:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You are {distance:.0f}m away from the office — outside the allowed "
                       f"{company.geofence_radius_meters:.0f}m geofence radius.",
            )

        # 3. Check for existing check-in today
        existing = self.repo.get_by_employee_and_date(employee_id, today)
        if existing and existing.check_in_time is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Already checked in today at {existing.check_in_time.strftime('%I:%M %p')}",
            )

        # 4. Save Selfie Photo
        ext = os_ext = "." + filename.split(".")[-1] if "." in filename else ".jpg"
        save_filename = generate_unique_filename(employee_id, "checkin", ext)
        relative_storage_path = f"attendance/{save_filename}"
        photo_url = self.storage.save_file(photo_file, relative_storage_path)

        # 5. Reverse Geocode & Google Maps URL
        address = reverse_geocode_sync(meta.latitude, meta.longitude)
        gmaps_url = build_google_maps_url(meta.latitude, meta.longitude)

        # 6. Status Computation
        shift = employee.shift if employee.shift_id else None
        initial_status = self._compute_check_in_status(current_time, shift, grace_period_mins, today, employee.company_id)

        # 7. Persist Attendance Record
        if existing:
            attendance = existing
            attendance.check_in_time = current_time
            attendance.check_in_photo_path = photo_url
            attendance.check_in_latitude = meta.latitude
            attendance.check_in_longitude = meta.longitude
            attendance.check_in_address = address
            attendance.check_in_google_maps_url = gmaps_url
            attendance.check_in_gps_accuracy = meta.gps_accuracy
            attendance.status = initial_status
        else:
            attendance = Attendance(
                employee_id=employee_id,
                date=today,
                check_in_time=current_time,
                check_in_photo_path=photo_url,
                check_in_latitude=meta.latitude,
                check_in_longitude=meta.longitude,
                check_in_address=address,
                check_in_google_maps_url=gmaps_url,
                check_in_gps_accuracy=meta.gps_accuracy,
                status=initial_status,
            )
            self.repo.create(attendance)
            self.db.flush()

        # 8. Log Telemetry to Device Log (with face embedding column ready)
        device_log = AttendanceDeviceLog(
            attendance_id=attendance.id,
            employee_id=employee_id,
            action_type=DeviceActionEnum.CHECK_IN,
            device_id=meta.device_id,
            device_model=meta.device_model,
            os_version=meta.os_version,
            app_version=meta.app_version,
            ip_address=ip_address,
            connection_type=meta.connection_type,
            latitude=meta.latitude,
            longitude=meta.longitude,
            gps_accuracy=meta.gps_accuracy,
            photo_path=photo_url,
            face_embedding=meta.face_embedding,
            captured_at=now,
        )
        self.repo.add_device_log(device_log)

        # Audit log
        self.audit_repo.log(
            user_id=employee.user.id if employee.user else None,
            action="attendance_check_in",
            entity_type="Attendance",
            entity_id=attendance.id,
            ip_address=ip_address,
            after_data={"status": initial_status.value, "time": current_time.strftime("%H:%M:%S")},
        )

        self.db.commit()
        self.db.refresh(attendance)
        return AttendanceResponse.model_validate(attendance)

    # ------------------------------------------------------------------
    # Check-Out
    # ------------------------------------------------------------------

    def process_check_out(
        self,
        employee_id: int,
        meta: CheckOutMetaData,
        photo_file: BinaryIO,
        filename: str,
        ip_address: Optional[str] = None,
    ) -> AttendanceResponse:
        today = today_ist()
        now = now_ist()
        current_time = now.time()

        attendance = self.repo.get_by_employee_and_date(employee_id, today)
        if not attendance or attendance.check_in_time is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have not checked in today yet",
            )

        if attendance.check_out_time is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Already checked out today at {attendance.check_out_time.strftime('%I:%M %p')}",
            )

        # Validate GPS
        if not validate_gps_accuracy(meta.gps_accuracy, max_allowed_meters=50.0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"GPS accuracy ({meta.gps_accuracy:.1f}m) is lower than required threshold. Move to an open area and retry.",
            )

        employee = self.employee_repo.get(employee_id)
        company = employee.company if employee else None
        within_geofence, distance = validate_geofence(
            meta.latitude, meta.longitude,
            company.office_latitude if company else None,
            company.office_longitude if company else None,
            company.geofence_radius_meters if company else None,
        )
        if not within_geofence:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You are {distance:.0f}m away from the office — outside the allowed "
                       f"{company.geofence_radius_meters:.0f}m geofence radius.",
            )

        # Save photo
        ext = "." + filename.split(".")[-1] if "." in filename else ".jpg"
        save_filename = generate_unique_filename(employee_id, "checkout", ext)
        relative_storage_path = f"attendance/{save_filename}"
        photo_url = self.storage.save_file(photo_file, relative_storage_path)

        # Reverse Geocode & Google Maps URL (matches check-in behavior)
        address = reverse_geocode_sync(meta.latitude, meta.longitude)
        gmaps_url = build_google_maps_url(meta.latitude, meta.longitude)

        # Compute Working Hours
        check_in_dt = datetime.combine(today, attendance.check_in_time)
        check_out_dt = datetime.combine(today, current_time)
        delta_seconds = (check_out_dt - check_in_dt).total_seconds()
        working_hours = round(max(0.0, delta_seconds / 3600.0), 2)

        # Update Attendance Record
        attendance.check_out_time = current_time
        attendance.check_out_photo_path = photo_url
        attendance.check_out_latitude = meta.latitude
        attendance.check_out_longitude = meta.longitude
        attendance.check_out_address = address
        attendance.check_out_google_maps_url = gmaps_url
        attendance.check_out_gps_accuracy = meta.gps_accuracy
        attendance.working_hours = working_hours
        if meta.task_summary:
            attendance.checkout_task_summary = meta.task_summary

        # Update final status based on working hours
        shift = employee.shift if employee and employee.shift_id else None
        half_day_thresh = float(shift.half_day_hours) if shift else 4.0

        if working_hours < half_day_thresh and attendance.status not in (AttendanceStatusEnum.LATE, AttendanceStatusEnum.WFH, AttendanceStatusEnum.ON_DUTY):
            attendance.status = AttendanceStatusEnum.HALF_DAY

        # Log Telemetry
        device_log = AttendanceDeviceLog(
            attendance_id=attendance.id,
            employee_id=employee_id,
            action_type=DeviceActionEnum.CHECK_OUT,
            device_id=meta.device_id,
            device_model=meta.device_model,
            os_version=meta.os_version,
            app_version=meta.app_version,
            ip_address=ip_address,
            connection_type=meta.connection_type,
            latitude=meta.latitude,
            longitude=meta.longitude,
            gps_accuracy=meta.gps_accuracy,
            photo_path=photo_url,
            captured_at=now,
        )
        self.repo.add_device_log(device_log)

        self.audit_repo.log(
            user_id=employee.user.id if employee and employee.user else None,
            action="attendance_check_out",
            entity_type="Attendance",
            entity_id=attendance.id,
            ip_address=ip_address,
            after_data={"working_hours": working_hours, "status": attendance.status.value},
        )

        self.db.commit()
        self.db.refresh(attendance)
        return AttendanceResponse.model_validate(attendance)

    # ------------------------------------------------------------------
    # Query & Regularization
    # ------------------------------------------------------------------

    def get_my_history(self, employee_id: int, page: int = 1, page_size: int = 30) -> PaginatedResponse[AttendanceResponse]:
        employee = self.employee_repo.get(employee_id)
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

        skip = (page - 1) * page_size
        items, total = self.repo.list_paginated(
            company_id=employee.company_id,
            skip=skip,
            limit=page_size,
            employee_id=employee_id,
        )
        return PaginatedResponse(
            data=[AttendanceResponse.model_validate(a) for a in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 0,
        )

    def get_today_summary(self, company_id: int) -> AttendanceTodaySummary:
        counts = self.repo.get_today_summary(company_id, today_ist())
        return AttendanceTodaySummary(**counts)

    def list_attendance(
        self,
        company_id: int,
        page: int = 1,
        page_size: int = 20,
        employee_id: Optional[int] = None,
        department_id: Optional[int] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        status_filter: Optional[AttendanceStatusEnum] = None,
        search: Optional[str] = None,
    ) -> PaginatedResponse[AttendanceResponse]:
        skip = (page - 1) * page_size
        items, total = self.repo.list_paginated(
            company_id=company_id,
            skip=skip,
            limit=page_size,
            employee_id=employee_id,
            department_id=department_id,
            from_date=from_date,
            to_date=to_date,
            status=status_filter,
            search=search,
        )
        return PaginatedResponse(
            data=[AttendanceResponse.model_validate(a) for a in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 0,
        )

    def get_detail(
        self,
        attendance_id: int,
        requesting_employee_id: Optional[int] = None,
    ) -> AttendanceResponse:
        """
        `requesting_employee_id` scopes the lookup to a plain employee's own
        record — pass it whenever the caller only has "view own" rights, so a
        record ID for someone else's selfie/GPS/notes can't be enumerated.
        Admin/HR/Manager callers (who have broader "view attendance" rights)
        should pass None.
        """
        attendance = self.repo.get_with_logs(attendance_id)
        if not attendance:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")
        if requesting_employee_id is not None and attendance.employee_id != requesting_employee_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own attendance records")
        return AttendanceResponse.model_validate(attendance)

    def regularize(
        self,
        attendance_id: int,
        payload: RegularizeAttendanceRequest,
        actor_id: int,
    ) -> AttendanceResponse:
        attendance = self.repo.get(attendance_id)
        if not attendance:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")

        before_status = attendance.status.value
        attendance.status = payload.status
        if payload.check_in_time is not None:
            attendance.check_in_time = payload.check_in_time
        if payload.check_out_time is not None:
            attendance.check_out_time = payload.check_out_time
            if attendance.check_in_time:
                check_in_dt = datetime.combine(attendance.date, attendance.check_in_time)
                check_out_dt = datetime.combine(attendance.date, payload.check_out_time)
                attendance.working_hours = round(max(0.0, (check_out_dt - check_in_dt).total_seconds() / 3600.0), 2)

        attendance.remarks = f"Regularized by admin/manager: {payload.remarks}"
        attendance.is_regularized = True

        self.audit_repo.log(
            user_id=actor_id,
            action="attendance_regularized",
            entity_type="Attendance",
            entity_id=attendance.id,
            before_data={"status": before_status},
            after_data={"status": payload.status.value, "remarks": payload.remarks},
        )

        self.db.commit()
        self.db.refresh(attendance)
        return AttendanceResponse.model_validate(attendance)

    # ------------------------------------------------------------------
    # Private Helper
    # ------------------------------------------------------------------

    def _compute_check_in_status(
        self,
        check_in_time: time,
        shift: Optional[Shift],
        grace_period_mins: int,
        today: date,
        company_id: int,
    ) -> AttendanceStatusEnum:
        # Check if today is a Holiday
        holiday = (
            self.db.query(Holiday)
            .filter(Holiday.company_id == company_id, Holiday.date == today)
            .first()
        )
        if holiday:
            return AttendanceStatusEnum.HOLIDAY

        if not shift:
            return AttendanceStatusEnum.PRESENT

        # Compute shift deadline (start_time + grace_period)
        dummy_date = date(2000, 1, 1)
        shift_start_dt = datetime.combine(dummy_date, shift.start_time)
        deadline_dt = shift_start_dt + timedelta(minutes=grace_period_mins)

        check_in_dt = datetime.combine(dummy_date, check_in_time)

        if check_in_dt > deadline_dt:
            return AttendanceStatusEnum.LATE

        return AttendanceStatusEnum.PRESENT
