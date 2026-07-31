"""Pydantic v2 DTOs — Leave types, holidays, settings."""
from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.models.leave import AccrualTypeEnum, HolidayTypeEnum


# ---------------------------------------------------------------------------
# LeaveType
# ---------------------------------------------------------------------------

class LeaveTypeCreate(BaseModel):
    company_id: int
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=20)
    days_per_year: int = Field(..., ge=0, le=365)
    accrual_type: AccrualTypeEnum = AccrualTypeEnum.UPFRONT
    carry_forward: bool = False
    max_carry_forward_days: int = Field(default=0, ge=0)
    is_paid: bool = True


class LeaveTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    days_per_year: Optional[int] = Field(None, ge=0, le=365)
    accrual_type: Optional[AccrualTypeEnum] = None
    carry_forward: Optional[bool] = None
    max_carry_forward_days: Optional[int] = Field(None, ge=0)
    is_paid: Optional[bool] = None
    is_active: Optional[bool] = None


class LeaveTypeResponse(BaseModel):
    id: int
    company_id: int
    name: str
    code: str
    days_per_year: int
    accrual_type: AccrualTypeEnum
    carry_forward: bool
    max_carry_forward_days: int
    is_paid: bool
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Holiday
# ---------------------------------------------------------------------------

class HolidayCreate(BaseModel):
    company_id: int
    name: str = Field(..., min_length=1, max_length=200)
    date: date
    type: HolidayTypeEnum = HolidayTypeEnum.NATIONAL


class HolidayUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    date: Optional[date] = None
    type: Optional[HolidayTypeEnum] = None


class HolidayResponse(BaseModel):
    id: int
    company_id: int
    name: str
    date: date
    type: HolidayTypeEnum
    created_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Phase 3 — Leave Applications & Balances
# ---------------------------------------------------------------------------

class ApplyLeaveRequest(BaseModel):
    leave_type_id: int
    from_date: date
    to_date: date
    total_days: float = Field(..., gt=0.0)
    reason: Optional[str] = None


class LeaveApprovalActionRequest(BaseModel):
    remarks: Optional[str] = None


class LeaveBalanceResponse(BaseModel):
    id: int
    employee_id: int
    leave_type_id: int
    leave_type_name: Optional[str] = None
    leave_type_code: Optional[str] = None
    year: int
    total_days: float
    used_days: float
    balance_days: float

    model_config = {"from_attributes": True}


class LeaveEmployeeSummary(BaseModel):
    id: int
    employee_code: str
    first_name: str
    last_name: str
    full_name: str
    email: str
    department_name: Optional[str] = None

    model_config = {"from_attributes": True}


class LeaveResponse(BaseModel):
    id: int
    employee_id: int
    employee: Optional[LeaveEmployeeSummary] = None
    leave_type_id: int
    leave_type: Optional[LeaveTypeResponse] = None
    from_date: date
    to_date: date
    total_days: float
    reason: Optional[str]
    status: str
    applied_by: int
    first_approver_id: Optional[int]
    first_approval_status: str
    first_approval_at: Optional[datetime]
    final_approver_id: Optional[int]
    final_approval_status: str
    final_approval_at: Optional[datetime]
    rejection_reason: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TeamCalendarLeaveItem(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    department_name: Optional[str] = None
    leave_type_code: str
    leave_type_name: str
    from_date: date
    to_date: date
    total_days: float
    status: str

