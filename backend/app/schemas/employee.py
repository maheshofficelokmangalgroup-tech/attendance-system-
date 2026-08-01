"""Pydantic v2 DTOs — Employee."""
from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.employee import GenderEnum, EmploymentTypeEnum


class EmployeeCreate(BaseModel):
    company_id: int
    department_id: Optional[int] = None
    designation_id: Optional[int] = None
    shift_id: Optional[int] = None
    manager_id: Optional[int] = None
    employee_code: str = Field(..., min_length=1, max_length=50)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: EmailStr
    date_of_birth: Optional[date] = None
    date_of_joining: date
    gender: Optional[GenderEnum] = None
    address: Optional[str] = None
    employment_type: EmploymentTypeEnum = EmploymentTypeEnum.FULL_TIME
    # Role for user account creation
    role_id: int
    # Initial login password — if omitted, defaults to employee_code
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    # Optional alternate login identifier (e.g. "Rohan@YRK") for employees who
    # log in with a username instead of their email address.
    username: Optional[str] = Field(None, max_length=150)


class EmployeeUpdate(BaseModel):
    department_id: Optional[int] = None
    designation_id: Optional[int] = None
    shift_id: Optional[int] = None
    manager_id: Optional[int] = None
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[date] = None
    gender: Optional[GenderEnum] = None
    address: Optional[str] = None
    employment_type: Optional[EmploymentTypeEnum] = None
    role_id: Optional[int] = None
    is_active: Optional[bool] = None


class DepartmentSummary(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class DesignationSummary(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class ShiftSummary(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class RoleSummary(BaseModel):
    id: int
    name: str
    slug: str
    model_config = {"from_attributes": True}


class EmployeeResponse(BaseModel):
    id: int
    company_id: int
    employee_code: str
    first_name: str
    last_name: str
    full_name: str
    email: str
    phone: Optional[str]
    date_of_birth: Optional[date]
    date_of_joining: date
    gender: Optional[GenderEnum]
    address: Optional[str]
    photo_path: Optional[str]
    employment_type: EmploymentTypeEnum
    is_active: bool
    department: Optional[DepartmentSummary]
    designation: Optional[DesignationSummary]
    shift: Optional[ShiftSummary]
    manager_id: Optional[int]
    # Role of the linked login account — not an Employee column, populated by
    # the service layer from employee.user.role_id (needed for edit-form prefill).
    role_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminSetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=100)


class EmployeeListItem(BaseModel):
    """Lightweight DTO for list views — avoids over-fetching."""
    id: int
    employee_code: str
    full_name: str
    email: str
    phone: Optional[str]
    department: Optional[DepartmentSummary]
    designation: Optional[DesignationSummary]
    employment_type: EmploymentTypeEnum
    is_active: bool

    model_config = {"from_attributes": True}
