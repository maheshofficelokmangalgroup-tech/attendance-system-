"""Pydantic v2 DTOs — Company, Department, Designation, Shift."""
from __future__ import annotations
from datetime import datetime, time
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------------------------
# Company
# ---------------------------------------------------------------------------

class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    address: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    address: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None


class CompanyResponse(BaseModel):
    id: int
    name: str
    address: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    logo_path: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Department
# ---------------------------------------------------------------------------

class DepartmentCreate(BaseModel):
    company_id: int
    name: str = Field(..., min_length=1, max_length=200)
    manager_id: Optional[int] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    manager_id: Optional[int] = None
    is_active: Optional[bool] = None


class DepartmentResponse(BaseModel):
    id: int
    company_id: int
    name: str
    manager_id: Optional[int]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Designation
# ---------------------------------------------------------------------------

class DesignationCreate(BaseModel):
    department_id: int
    name: str = Field(..., min_length=1, max_length=200)


class DesignationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    is_active: Optional[bool] = None


class DesignationResponse(BaseModel):
    id: int
    department_id: int
    name: str
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Shift
# ---------------------------------------------------------------------------

class ShiftCreate(BaseModel):
    company_id: int
    name: str = Field(..., min_length=1, max_length=100)
    start_time: time
    end_time: time
    grace_period_minutes: int = Field(default=0, ge=0, le=120)
    half_day_hours: float = Field(default=4.0, ge=0)
    working_hours: float = Field(default=8.0, ge=0)
    overtime_threshold_minutes: int = Field(default=30, ge=0)


class ShiftUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    grace_period_minutes: Optional[int] = Field(None, ge=0, le=120)
    half_day_hours: Optional[float] = Field(None, ge=0)
    working_hours: Optional[float] = Field(None, ge=0)
    overtime_threshold_minutes: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class ShiftResponse(BaseModel):
    id: int
    company_id: int
    name: str
    start_time: time
    end_time: time
    grace_period_minutes: int
    half_day_hours: float
    working_hours: float
    overtime_threshold_minutes: int
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}
