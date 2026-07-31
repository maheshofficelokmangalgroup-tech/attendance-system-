"""
SQLAlchemy ORM models — Attendance aggregate.
Entities: Attendance, AttendanceDeviceLogs
"""
from __future__ import annotations
from datetime import date, datetime, time
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey, Integer,
    LargeBinary, Numeric, String, Text, Time, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.leave import Leave


class AttendanceStatusEnum(str, enum.Enum):
    PRESENT = "present"
    WFH = "wfh"
    ON_DUTY = "on_duty"
    COMP_OFF = "comp_off"
    LATE = "late"
    HALF_DAY = "half_day"
    EARLY_EXIT = "early_exit"
    ABSENT = "absent"
    LWP = "lwp"               # Leave Without Pay
    ON_LEAVE = "on_leave"
    HOLIDAY = "holiday"
    WEEKLY_OFF = "weekly_off"


class DeviceActionEnum(str, enum.Enum):
    CHECK_IN = "check_in"
    CHECK_OUT = "check_out"


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Check-in
    check_in_time: Mapped[Optional[time]] = mapped_column(Time)
    check_in_photo_path: Mapped[Optional[str]] = mapped_column(String(500))
    check_in_latitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 8))
    check_in_longitude: Mapped[Optional[float]] = mapped_column(Numeric(11, 8))
    check_in_address: Mapped[Optional[str]] = mapped_column(String(500))
    check_in_google_maps_url: Mapped[Optional[str]] = mapped_column(String(500))
    check_in_gps_accuracy: Mapped[Optional[float]] = mapped_column(Numeric(8, 2))

    # Check-out
    check_out_time: Mapped[Optional[time]] = mapped_column(Time)
    check_out_photo_path: Mapped[Optional[str]] = mapped_column(String(500))
    check_out_latitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 8))
    check_out_longitude: Mapped[Optional[float]] = mapped_column(Numeric(11, 8))
    check_out_address: Mapped[Optional[str]] = mapped_column(String(500))
    check_out_google_maps_url: Mapped[Optional[str]] = mapped_column(String(500))
    check_out_gps_accuracy: Mapped[Optional[float]] = mapped_column(Numeric(8, 2))
    # What the employee says they worked on today, entered at check-out time.
    checkout_task_summary: Mapped[Optional[str]] = mapped_column(Text)

    # Computed
    working_hours: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    status: Mapped[AttendanceStatusEnum] = mapped_column(
        Enum(AttendanceStatusEnum), nullable=False, index=True
    )

    # Leave linkage (set by leave workflow)
    leave_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("leaves.id", ondelete="SET NULL"), nullable=True, index=True
    )

    remarks: Mapped[Optional[str]] = mapped_column(Text)
    is_regularized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        # Enforce one attendance row per employee per day
        UniqueConstraint("employee_id", "date", name="uq_attendance_employee_date"),
    )

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="attendances")
    device_logs: Mapped[List["AttendanceDeviceLog"]] = relationship(
        "AttendanceDeviceLog", back_populates="attendance", cascade="all, delete-orphan"
    )
    leave: Mapped[Optional["Leave"]] = relationship("Leave", back_populates="attendance_records")


class AttendanceDeviceLog(Base):
    """
    Raw device telemetry captured on every check-in/out action.
    Also stores the selfie and a nullable face_embedding column —
    recognition-ready without a breaking migration later.
    """
    __tablename__ = "attendance_device_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    attendance_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("attendance.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action_type: Mapped[DeviceActionEnum] = mapped_column(
        Enum(DeviceActionEnum), nullable=False
    )

    # Device info
    device_id: Mapped[Optional[str]] = mapped_column(String(200))
    device_model: Mapped[Optional[str]] = mapped_column(String(200))
    os_version: Mapped[Optional[str]] = mapped_column(String(100))
    app_version: Mapped[Optional[str]] = mapped_column(String(50))

    # Network info
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))    # IPv6 max length
    connection_type: Mapped[Optional[str]] = mapped_column(String(50))

    # Location
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 8))
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(11, 8))
    gps_accuracy: Mapped[Optional[float]] = mapped_column(Numeric(8, 2))

    # Selfie
    photo_path: Mapped[Optional[str]] = mapped_column(String(500))

    # Face recognition — store column now, populate later (nullable BLOB)
    face_embedding: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)

    captured_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    attendance: Mapped["Attendance"] = relationship(
        "Attendance", back_populates="device_logs"
    )
