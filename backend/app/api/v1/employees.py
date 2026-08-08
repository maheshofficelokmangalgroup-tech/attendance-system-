"""Employees router — /api/v1/employees"""
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User
from app.services.employee_service import EmployeeService
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse, EmployeeListItem,
    AdminSetPasswordRequest,
    EmployeeKycUpsert, EmployeeKycResponse,
    EmployeeAssetCreate, EmployeeAssetUpdate, EmployeeAssetResponse,
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


@router.post(
    "/{employee_id}/photo",
    response_model=APIResponse[EmployeeResponse],
    summary="Upload/replace employee photo",
)
def upload_employee_photo(
    employee_id: int,
    photo: UploadFile = File(...),
    current_user: User = Depends(require_permission("update", "employee")),
    db: Session = Depends(get_db),
):
    svc = EmployeeService(db)
    data = svc.upload_photo(employee_id, photo)
    return APIResponse(data=data, message="Photo uploaded")


@router.get(
    "/{employee_id}/kyc",
    response_model=APIResponse[Optional[EmployeeKycResponse]],
    summary="Get employee KYC & bank details",
)
def get_employee_kyc(
    employee_id: int,
    current_user: User = Depends(require_permission("view", "employee_kyc")),
    db: Session = Depends(get_db),
):
    svc = EmployeeService(db)
    return APIResponse(data=svc.get_kyc(employee_id))


@router.put(
    "/{employee_id}/kyc",
    response_model=APIResponse[EmployeeKycResponse],
    summary="Create/update employee KYC & bank details",
)
def upsert_employee_kyc(
    employee_id: int,
    payload: EmployeeKycUpsert,
    request: Request,
    current_user: User = Depends(require_permission("update", "employee_kyc")),
    db: Session = Depends(get_db),
):
    svc = EmployeeService(db)
    data = svc.upsert_kyc(employee_id, payload, actor_id=current_user.id, ip=request.client.host if request.client else None)
    return APIResponse(data=data, message="KYC details saved")


@router.get(
    "/{employee_id}/assets",
    response_model=APIResponse[List[EmployeeAssetResponse]],
    summary="List assets assigned to an employee",
)
def list_employee_assets(
    employee_id: int,
    current_user: User = Depends(require_permission("view", "employee_asset")),
    db: Session = Depends(get_db),
):
    svc = EmployeeService(db)
    return APIResponse(data=svc.list_assets(employee_id))


@router.post(
    "/{employee_id}/assets",
    response_model=APIResponse[EmployeeAssetResponse],
    summary="Assign a new asset to an employee",
)
def add_employee_asset(
    employee_id: int,
    payload: EmployeeAssetCreate,
    request: Request,
    current_user: User = Depends(require_permission("create", "employee_asset")),
    db: Session = Depends(get_db),
):
    svc = EmployeeService(db)
    data = svc.add_asset(employee_id, payload, actor_id=current_user.id, ip=request.client.host if request.client else None)
    return APIResponse(data=data, message="Asset assigned")


@router.put(
    "/{employee_id}/assets/{asset_id}",
    response_model=APIResponse[EmployeeAssetResponse],
    summary="Update an assigned asset (e.g. mark returned)",
)
def update_employee_asset(
    employee_id: int,
    asset_id: int,
    payload: EmployeeAssetUpdate,
    request: Request,
    current_user: User = Depends(require_permission("update", "employee_asset")),
    db: Session = Depends(get_db),
):
    svc = EmployeeService(db)
    data = svc.update_asset(employee_id, asset_id, payload, actor_id=current_user.id, ip=request.client.host if request.client else None)
    return APIResponse(data=data, message="Asset updated")


@router.delete(
    "/{employee_id}/assets/{asset_id}",
    response_model=APIResponse[None],
    summary="Remove an asset record",
)
def delete_employee_asset(
    employee_id: int,
    asset_id: int,
    request: Request,
    current_user: User = Depends(require_permission("delete", "employee_asset")),
    db: Session = Depends(get_db),
):
    svc = EmployeeService(db)
    svc.delete_asset(employee_id, asset_id, actor_id=current_user.id, ip=request.client.host if request.client else None)
    return APIResponse(message="Asset removed")
