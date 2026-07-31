"""Pydantic v2 DTOs — Attendance Engine."""
from __future__ import annotations
from datetime import date, datetime, time
from typing import List, Optional
from pydantic import BaseModel, Field

from app.models.attendance import AttendanceStatusEnum, DeviceActionEnum


class CheckInMetaData(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    gps_accuracy: float = Field(..., ge=0.0)
    device_id: Optional[str] = None
    device_model: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    connection_type: Optional[str] = None
    face_embedding: Optional[bytes] = None  # Nullable BLOB for future face recognition


class CheckOutMetaData(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    gps_accuracy: float = Field(..., ge=0.0)
    device_id: Optional[str] = None
    device_model: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    connection_type: Optional[str] = None
    task_summary: Optional[str] = Field(None, max_length=2000)


class AttendanceDeviceLogResponse(BaseModel):
    id: int
    action_type: DeviceActionEnum
    device_id: Optional[str]
    device_model: Optional[str]
    os_version: Optional[str]
    app_version: Optional[str]
    ip_address: Optional[str]
    connection_type: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    gps_accuracy: Optional[float]
    photo_path: Optional[str]
    captured_at: datetime

    model_config = {"from_attributes": True}


class EmployeeMinimal(BaseModel):
    id: int
    employee_code: str
    first_name: str
    last_name: str
    full_name: str
    email: str
    photo_path: Optional[str] = None

    model_config = {"from_attributes": True}


class AttendanceResponse(BaseModel):
    id: int
    employee_id: int
    employee: Optional[EmployeeMinimal] = None
    date: date
    check_in_time: Optional[time] = None
    check_in_photo_path: Optional[str] = None
    check_in_latitude: Optional[float] = None
    check_in_longitude: Optional[float] = None
    check_in_address: Optional[str] = None
    check_in_google_maps_url: Optional[str] = None
    check_in_gps_accuracy: Optional[float] = None

    check_out_time: Optional[time] = None
    check_out_photo_path: Optional[str] = None
    check_out_latitude: Optional[float] = None
    check_out_longitude: Optional[float] = None
    check_out_address: Optional[str] = None
    check_out_google_maps_url: Optional[str] = None
    check_out_gps_accuracy: Optional[float] = None
    checkout_task_summary: Optional[str] = None

    working_hours: Optional[float] = None
    status: AttendanceStatusEnum
    remarks: Optional[str] = None
    is_regularized: bool
    device_logs: List[AttendanceDeviceLogResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AttendanceTodaySummary(BaseModel):
    total_employees: int = 0
    present_today: int = 0
    absent_today: int = 0
    late_today: int = 0
    on_leave_today: int = 0
    wfh_today: int = 0
    on_duty_today: int = 0


class RegularizeAttendanceRequest(BaseModel):
    status: AttendanceStatusEnum
    check_in_time: Optional[time] = None
    check_out_time: Optional[time] = None
    remarks: str = Field(..., min_length=3)
