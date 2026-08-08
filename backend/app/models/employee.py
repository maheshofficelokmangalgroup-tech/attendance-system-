"""
SQLAlchemy ORM model — Employee aggregate.
"""
from __future__ import annotations
from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey,
    Integer, String, Text, func, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.company import Company, Department, Designation, Shift
    from app.models.attendance import Attendance
    from app.models.leave import Leave, LeaveBalance, CompOff
    from app.models.notification import Notification


class GenderEnum(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


class EmploymentTypeEnum(str, enum.Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERN = "intern"


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    designation_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("designations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    shift_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("shifts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Self-referential FK — reports to manager
    manager_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )

    employee_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    date_of_joining: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[Optional[GenderEnum]] = mapped_column(Enum(GenderEnum))
    address: Mapped[Optional[str]] = mapped_column(Text)
    permanent_address: Mapped[Optional[str]] = mapped_column(Text)
    present_address: Mapped[Optional[str]] = mapped_column(Text)
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(200))
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(String(20))
    emergency_contact_relation: Mapped[Optional[str]] = mapped_column(String(100))
    photo_path: Mapped[Optional[str]] = mapped_column(String(500))
    employment_type: Mapped[EmploymentTypeEnum] = mapped_column(
        Enum(EmploymentTypeEnum), default=EmploymentTypeEnum.FULL_TIME, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="employees")
    department: Mapped[Optional["Department"]] = relationship(
        "Department", back_populates="employees", foreign_keys=[department_id]
    )
    designation: Mapped[Optional["Designation"]] = relationship(
        "Designation", back_populates="employees"
    )
    shift: Mapped[Optional["Shift"]] = relationship("Shift", back_populates="employees")
    manager: Mapped[Optional["Employee"]] = relationship(
        "Employee", remote_side="Employee.id", foreign_keys=[manager_id]
    )
    direct_reports: Mapped[List["Employee"]] = relationship(
        "Employee", foreign_keys=[manager_id], back_populates="manager"
    )
    user: Mapped[Optional["User"]] = relationship(
        "User", back_populates="employee", foreign_keys="User.employee_id"
    )
    attendances: Mapped[List["Attendance"]] = relationship(
        "Attendance", back_populates="employee"
    )
    leaves: Mapped[List["Leave"]] = relationship(
        "Leave", back_populates="employee", foreign_keys="Leave.employee_id"
    )
    leave_balances: Mapped[List["LeaveBalance"]] = relationship(
        "LeaveBalance", back_populates="employee"
    )
    comp_offs: Mapped[List["CompOff"]] = relationship(
        "CompOff", back_populates="employee", foreign_keys="CompOff.employee_id"
    )
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification", back_populates="employee"
    )
    kyc: Mapped[Optional["EmployeeKyc"]] = relationship(
        "EmployeeKyc", back_populates="employee", uselist=False, cascade="all, delete-orphan"
    )
    assets: Mapped[List["EmployeeAsset"]] = relationship(
        "EmployeeAsset", back_populates="employee", cascade="all, delete-orphan"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class AssetStatusEnum(str, enum.Enum):
    ASSIGNED = "assigned"
    RETURNED = "returned"
    DAMAGED = "damaged"
    LOST = "lost"


class EmployeeKyc(Base):
    """KYC & bank details — split from Employee so sensitive PII (Aadhar,
    PAN, bank account) is gated by its own RBAC permission (admin/HR only),
    not the general employee 'view' permission every role has."""
    __tablename__ = "employee_kyc"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    aadhar_number: Mapped[Optional[str]] = mapped_column(String(20))
    pan_number: Mapped[Optional[str]] = mapped_column(String(20))
    bank_account_number: Mapped[Optional[str]] = mapped_column(String(30))
    bank_ifsc_code: Mapped[Optional[str]] = mapped_column(String(15))
    bank_name: Mapped[Optional[str]] = mapped_column(String(150))
    education_qualification: Mapped[Optional[str]] = mapped_column(String(150))
    education_institution: Mapped[Optional[str]] = mapped_column(String(200))
    education_year: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    employee: Mapped["Employee"] = relationship("Employee", back_populates="kyc")


class EmployeeAsset(Base):
    """A company asset (laptop, phone, ID card, ...) assigned to an employee."""
    __tablename__ = "employee_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_name: Mapped[str] = mapped_column(String(150), nullable=False)
    asset_type: Mapped[Optional[str]] = mapped_column(String(100))
    serial_number: Mapped[Optional[str]] = mapped_column(String(100))
    assigned_date: Mapped[date] = mapped_column(Date, nullable=False)
    return_date: Mapped[Optional[date]] = mapped_column(Date)
    condition_notes: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[AssetStatusEnum] = mapped_column(
        Enum(AssetStatusEnum), default=AssetStatusEnum.ASSIGNED, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    employee: Mapped["Employee"] = relationship("Employee", back_populates="assets")
