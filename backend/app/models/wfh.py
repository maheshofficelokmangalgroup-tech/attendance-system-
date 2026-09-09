"""
SQLAlchemy ORM model — Work From Home requests.

Single-stage approval (unlike the two-stage Leave chain) — WFH is a
lighter-weight, faster-turnaround request. Any Admin/HR/Manager can approve.
"""
from __future__ import annotations
from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.attendance import Attendance


class WfhStatusEnum(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class WfhRequest(Base):
    __tablename__ = "wfh_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )

    from_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    to_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[WfhStatusEnum] = mapped_column(
        Enum(WfhStatusEnum), default=WfhStatusEnum.PENDING, nullable=False, index=True
    )

    approver_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    employee: Mapped["Employee"] = relationship(
        "Employee", back_populates="wfh_requests", foreign_keys=[employee_id]
    )
    attendance_records: Mapped[List["Attendance"]] = relationship(
        "Attendance", back_populates="wfh_request"
    )
