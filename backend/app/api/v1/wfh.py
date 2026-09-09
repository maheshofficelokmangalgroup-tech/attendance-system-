"""WFH API router — /api/v1/wfh"""
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import get_current_active_employee, require_permission
from app.models.user import User
from app.models.wfh import WfhStatusEnum
from app.services.wfh_service import WfhService
from app.schemas.wfh import ApplyWfhRequest, WfhRejectRequest, WfhResponse
from app.schemas.common import APIResponse, PaginatedResponse

router = APIRouter(prefix="/wfh", tags=["Work From Home"])


@router.post("/apply", response_model=APIResponse[WfhResponse], summary="Apply for Work From Home")
def apply_wfh(
    payload: ApplyWfhRequest,
    current_user: User = Depends(get_current_active_employee),
    db: Session = Depends(get_db),
):
    svc = WfhService(db)
    result = svc.apply(employee_id=current_user.employee_id, payload=payload)
    return APIResponse(data=result, message="WFH request submitted")


@router.get("/my-history", response_model=PaginatedResponse[WfhResponse], summary="Get employee's own WFH request history")
def my_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_active_employee),
    db: Session = Depends(get_db),
):
    svc = WfhService(db)
    return svc.list_my(employee_id=current_user.employee_id, page=page, page_size=page_size)


@router.get("/pending", response_model=APIResponse[List[WfhResponse]], summary="Get pending WFH requests (Admin/HR/Manager)")
def pending(
    company_id: int = Query(default=1),
    current_user: User = Depends(require_permission("approve", "wfh")),
    db: Session = Depends(get_db),
):
    svc = WfhService(db)
    return APIResponse(data=svc.list_pending(company_id=company_id))


@router.get("", response_model=PaginatedResponse[WfhResponse], summary="List all WFH requests (Admin/HR/Manager view)")
def list_wfh(
    company_id: int = Query(default=1),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    employee_id: Optional[int] = Query(default=None),
    department_id: Optional[int] = Query(default=None),
    status_filter: Optional[WfhStatusEnum] = Query(default=None, alias="status"),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(require_permission("view", "wfh")),
    db: Session = Depends(get_db),
):
    svc = WfhService(db)
    return svc.list_all(
        company_id=company_id,
        page=page,
        page_size=page_size,
        employee_id=employee_id,
        department_id=department_id,
        status_filter=status_filter,
        from_date=from_date,
        to_date=to_date,
        search=search,
    )


@router.post("/{id}/approve", response_model=APIResponse[WfhResponse], summary="Approve a WFH request")
def approve_wfh(
    id: int,
    current_user: User = Depends(require_permission("approve", "wfh")),
    db: Session = Depends(get_db),
):
    svc = WfhService(db)
    return APIResponse(
        data=svc.approve(wfh_id=id, actor_user_id=current_user.id, actor_employee_id=current_user.employee_id),
        message="WFH request approved",
    )


@router.post("/{id}/reject", response_model=APIResponse[WfhResponse], summary="Reject a WFH request")
def reject_wfh(
    id: int,
    payload: WfhRejectRequest,
    current_user: User = Depends(require_permission("approve", "wfh")),
    db: Session = Depends(get_db),
):
    svc = WfhService(db)
    return APIResponse(
        data=svc.reject(wfh_id=id, actor_user_id=current_user.id, rejection_reason=payload.reason),
        message="WFH request rejected",
    )


@router.post("/{id}/cancel", response_model=APIResponse[WfhResponse], summary="Cancel own WFH request")
def cancel_wfh(
    id: int,
    current_user: User = Depends(get_current_active_employee),
    db: Session = Depends(get_db),
):
    svc = WfhService(db)
    return APIResponse(data=svc.cancel(wfh_id=id, employee_id=current_user.employee_id), message="WFH request cancelled")
