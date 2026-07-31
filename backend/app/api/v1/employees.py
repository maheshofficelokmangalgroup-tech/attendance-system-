"""Employees router — /api/v1/employees"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User
from app.services.employee_service import EmployeeService
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse, EmployeeListItem,
    AdminSetPasswordRequest,
)
from app.schemas.common import APIResponse, PaginatedResponse

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.post(
    "",
    response_model=APIResponse[EmployeeResponse],
    summary="Create employee + linked user account",
)
def create_employee(
    payload: EmployeeCreate,
    request: Request,
    current_user: User = Depends(require_permission("create", "employee")),
    db: Session = Depends(get_db),
):
    svc = EmployeeService(db)
    data = svc.create(payload, actor_id=current_user.id, ip=request.client.host if request.client else None)
    return APIResponse(data=data, message="Employee created")


@router.get(
    "",
    response_model=PaginatedResponse[EmployeeListItem],
    summary="List employees (paginated, searchable)",
)
def list_employees(
    company_id: int = Query(...),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    department_id: Optional[int] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    current_user: User = Depends(require_permission("view", "employee")),
    db: Session = Depends(get_db),
):
    svc = EmployeeService(db)
    return svc.list(
        company_id=company_id, page=page, page_size=page_size,
        search=search, department_id=department_id, is_active=is_active,
    )


@router.get(
    "/{employee_id}",
    response_model=APIResponse[EmployeeResponse],
    summary="Get employee detail",
)
def get_employee(
    employee_id: int,
    current_user: User = Depends(require_permission("view", "employee")),
    db: Session = Depends(get_db),
):
    svc = EmployeeService(db)
    return APIResponse(data=svc.get(employee_id))


@router.put(
    "/{employee_id}",
    response_model=APIResponse[EmployeeResponse],
    summary="Update employee",
)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    request: Request,
    current_user: User = Depends(require_permission("update", "employee")),
    db: Session = Depends(get_db),
):
    svc = EmployeeService(db)
    data = svc.update(employee_id, payload, actor_id=current_user.id, ip=request.client.host if request.client else None)
    return APIResponse(data=data, message="Employee updated")


@router.post(
    "/{employee_id}/reset-password",
    response_model=APIResponse[None],
    summary="Admin: set a new login password for an employee",
)
def reset_employee_password(
    employee_id: int,
    payload: AdminSetPasswordRequest,
    request: Request,
    current_user: User = Depends(require_permission("update", "employee")),
    db: Session = Depends(get_db),
):
    svc = EmployeeService(db)
    svc.reset_password(
        employee_id, payload.new_password,
        actor_id=current_user.id, ip=request.client.host if request.client else None,
    )
    return APIResponse(message="Password reset successfully")


@router.delete(
    "/{employee_id}",
    response_model=APIResponse[None],
    summary="Deactivate employee (soft delete)",
)
def delete_employee(
    employee_id: int,
    request: Request,
    current_user: User = Depends(require_permission("delete", "employee")),
    db: Session = Depends(get_db),
):
    svc = EmployeeService(db)
    svc.delete(employee_id, actor_id=current_user.id, ip=request.client.host if request.client else None)
    return APIResponse(message="Employee deactivated")
