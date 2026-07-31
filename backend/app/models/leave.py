"""
SQLAlchemy ORM models — Leave aggregate.
Entities: LeaveTypes, LeaveBalances, Leaves, CompOffs, Holidays
"""
from __future__ import annotations
from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey, Integer,
    Numeric, String, Text, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.company import Company
    from app.models.attendance import Attendance


class AccrualTypeEnum(str, enum.Enum):
    UPFRONT = "upfront"       # Full year allocation at the start of the year
    MONTHLY = "monthly"       # 1/12th of annual allocation each month
    QUARTERLY = "quarterly"


class LeaveApprovalStatusEnum(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class LeaveStatusEnum(str, enum.Enum):
    PENDING = "pending"
    FIRST_APPROVED = "first_approved"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class HolidayTypeEnum(str, enum.Enum):
    NATIONAL = "national"
    REGIONAL = "regional"
    OPTIONAL = "optional"
    COMPANY = "company"


class CompOffStatusEnum(str, enum.Enum):
    EARNED = "earned"
    APPROVED = "approved"
    USED = "used"
    EXPIRED = "expired"


class LeaveType(Base):
    __tablename__ = "leave_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    days_per_year: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    accrual_type: Mapped[AccrualTypeEnum] = mapped_column(
        Enum(AccrualTypeEnum), default=AccrualTypeEnum.UPFRONT, nullable=False
    )
    carry_forward: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    max_carry_forward_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_leave_type_company_code"),
    )

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="leave_types")
    leaves: Mapped[List["Leave"]] = relationship("Leave", back_populates="leave_type")
    leave_balances: Mapped[List["LeaveBalance"]] = relationship(
        "LeaveBalance", back_populates="leave_type"
    )


class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    leave_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False, index=True
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    total_days: Mapped[float] = mapped_column(Numeric(6, 2), default=0, nullable=False)
    used_days: Mapped[float] = mapped_column(Numeric(6, 2), default=0, nullable=False)
    balance_days: Mapped[float] = mapped_column(Numeric(6, 2), default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint(
            "employee_id", "leave_type_id", "year",
            name="uq_leave_balance_employee_type_year"
        ),
    )

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="leave_balances")
    leave_type: Mapped["LeaveType"] = relationship("LeaveType", back_populates="leave_balances")


class Leave(Base):
    __tablename__ = "leaves"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    leave_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("leave_types.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    from_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    to_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    total_days: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[LeaveStatusEnum] = mapped_column(
        Enum(LeaveStatusEnum), default=LeaveStatusEnum.PENDING, nullable=False, index=True
    )

    # Who submitted (could be HR applying on behalf)
    applied_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False
    )

    # First-level approval (Manager)
    first_approver_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    first_approval_status: Mapped[LeaveApprovalStatusEnum] = mapped_column(
        Enum(LeaveApprovalStatusEnum),
        default=LeaveApprovalStatusEnum.PENDING,
        nullable=False,
    )
    first_approval_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Final approval (HR/Admin)
    final_approver_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    final_approval_status: Mapped[LeaveApprovalStatusEnum] = mapped_column(
        Enum(LeaveApprovalStatusEnum),
        default=LeaveApprovalStatusEnum.PENDING,
        nullable=False,
    )
    final_approval_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    employee: Mapped["Employee"] = relationship(
        "Employee", back_populates="leaves", foreign_keys=[employee_id]
    )
    leave_type: Mapped["LeaveType"] = relationship("LeaveType", back_populates="leaves")
    attendance_records: Mapped[List["Attendance"]] = relationship(
        "Attendance", back_populates="leave"
    )


class Holiday(Base):
    __tablename__ = "holidays"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    type: Mapped[HolidayTypeEnum] = mapped_column(
        Enum(HolidayTypeEnum), default=HolidayTypeEnum.NATIONAL, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "date", name="uq_holiday_company_date"),
    )

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="holidays")


class CompOff(Base):
    """Compensatory off earned by working on a holiday or weekend."""
    __tablename__ = "comp_offs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    earned_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    days: Mapped[float] = mapped_column(Numeric(4, 2), default=1.0, nullable=False)
    status: Mapped[CompOffStatusEnum] = mapped_column(
        Enum(CompOffStatusEnum), default=CompOffStatusEnum.EARNED, nullable=False
    )
    approved_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    employee: Mapped["Employee"] = relationship(
        "Employee", back_populates="comp_offs", foreign_keys=[employee_id]
    )
