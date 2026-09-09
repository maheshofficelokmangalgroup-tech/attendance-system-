"""Pydantic v2 DTOs — Work From Home requests."""
from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class ApplyWfhRequest(BaseModel):
    from_date: date
    to_date: date
    reason: str = Field(..., min_length=1, max_length=2000)


class WfhApprovalActionRequest(BaseModel):
    remarks: Optional[str] = None


class WfhRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=1000)


class WfhEmployeeSummary(BaseModel):
    id: int
    employee_code: str
    first_name: str
    last_name: str
    full_name: str
    email: str
    department_name: Optional[str] = None

    model_config = {"from_attributes": True}


class WfhResponse(BaseModel):
    id: int
    employee_id: int
    employee: Optional[WfhEmployeeSummary] = None
    from_date: date
    to_date: date
    reason: str
    status: str
    approver_id: Optional[int]
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
