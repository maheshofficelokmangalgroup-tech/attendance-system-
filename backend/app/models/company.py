"""
SQLAlchemy ORM models — Company aggregate.
Entities: Companies, Departments, Designations, Shifts, AttendanceRules
"""
from __future__ import annotations
from datetime import datetime, time
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String,
    Text, Time, func, UniqueConstraint, Numeric,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.leave import LeaveType, Holiday
    from app.models.settings import Settings


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[Optional[str]] = mapped_column(String(200))
    logo_path: Mapped[Optional[str]] = mapped_column(String(500))
    # Office geofence — when set, check-in/out GPS is validated against this
    # point + radius, in addition to the raw device accuracy check.
    office_latitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 8))
    office_longitude: Mapped[Optional[float]] = mapped_column(Numeric(11, 8))
    geofence_radius_meters: Mapped[Optional[float]] = mapped_column(Numeric(8, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    departments: Mapped[List["Department"]] = relationship(
        "Department", back_populates="company", cascade="all, delete-orphan"
    )
    shifts: Mapped[List["Shift"]] = relationship(
        "Shift", back_populates="company", cascade="all, delete-orphan"
    )
    employees: Mapped[List["Employee"]] = relationship(
        "Employee", back_populates="company"
    )
    leave_types: Mapped[List["LeaveType"]] = relationship(
        "LeaveType", back_populates="company", cascade="all, delete-orphan"
    )
    holidays: Mapped[List["Holiday"]] = relationship(
        "Holiday", back_populates="company", cascade="all, delete-orphan"
    )
    settings: Mapped[List["Settings"]] = relationship(
        "Settings", back_populates="company", cascade="all, delete-orphan"
    )
    attendance_rules: Mapped[Optional["AttendanceRules"]] = relationship(
        "AttendanceRules", back_populates="company", uselist=False,
        cascade="all, delete-orphan"
    )


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # manager_id is a self-referential FK to employees — set after Employee model exists
    manager_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_dept_company_name"),
    )

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="departments")
    designations: Mapped[List["Designation"]] = relationship(
        "Designation", back_populates="department", cascade="all, delete-orphan"
    )
    employees: Mapped[List["Employee"]] = relationship(
        "Employee", back_populates="department", foreign_keys="Employee.department_id"
    )
    manager: Mapped[Optional["Employee"]] = relationship(
        "Employee", foreign_keys=[manager_id]
    )


class Designation(Base):
    __tablename__ = "designations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("department_id", "name", name="uq_desig_dept_name"),
    )

    # Relationships
    department: Mapped["Department"] = relationship(
        "Department", back_populates="designations"
    )
    employees: Mapped[List["Employee"]] = relationship(
        "Employee", back_populates="designation"
    )


class Shift(Base):
    __tablename__ = "shifts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    grace_period_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    half_day_hours: Mapped[float] = mapped_column(Numeric(4, 2), default=4.0, nullable=False)
    working_hours: Mapped[float] = mapped_column(Numeric(4, 2), default=8.0, nullable=False)
    overtime_threshold_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="shifts")
    employees: Mapped[List["Employee"]] = relationship("Employee", back_populates="shift")


class AttendanceRules(Base):
    """
    Company-level attendance policy config.
    One row per company (1:1 with Company).
    """
    __tablename__ = "attendance_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True
    )
    grace_period_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    half_day_hours: Mapped[float] = mapped_column(Numeric(4, 2), default=4.0, nullable=False)
    full_day_hours: Mapped[float] = mapped_column(Numeric(4, 2), default=8.0, nullable=False)
    overtime_threshold_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    comp_off_threshold_minutes: Mapped[int] = mapped_column(Integer, default=240, nullable=False)
    allow_wfh: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_on_duty: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="attendance_rules")
