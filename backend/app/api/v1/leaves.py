"""Leaves API router — /api/v1/leaves"""
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import get_current_user, get_current_active_employee, require_permission
from app.models.user import User
from app.models.leave import LeaveStatusEnum
from app.services.leave_service import LeaveService
from app.schemas.leave import (
    ApplyLeaveRequest, LeaveApprovalActionRequest, LeaveResponse,
    LeaveBalanceResponse, TeamCalendarLeaveItem,
)
from app.schemas.common import APIResponse, PaginatedResponse

router = APIRouter(prefix="/leaves", tags=["Leave Management"])


@router.post("/apply", response_model=APIResponse[LeaveResponse], summary="Apply for leave")
def apply_leave(
    payload: ApplyLeaveRequest,
    current_user: User = Depends(get_current_active_employee),
    db: Session = Depends(get_db),
):
    svc = LeaveService(db)
    result = svc.apply_leave(employee_id=current_user.employee_id, payload=payload)
    return APIResponse(data=result, message="Leave application submitted")


@router.get("/my-balances", response_model=APIResponse[List[LeaveBalanceResponse]], summary="Get employee leave balances")
def my_balances(
    year: Optional[int] = Query(default=None),
    current_user: User = Depends(get_current_active_employee),
    db: Session = Depends(get_db),
):
    svc = LeaveService(db)
    return APIResponse(data=svc.get_my_balances(employee_id=current_user.employee_id, year=year))


@router.get("/my-history", response_model=PaginatedResponse[LeaveResponse], summary="Get employee leave application history")
def my_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_active_employee),
    db: Session = Depends(get_db),
):
    svc = LeaveService(db)
    return svc.list_leaves(company_id=1, page=page, page_size=page_size, employee_id=current_user.employee_id)


@router.get("/approval-queue", response_model=APIResponse[List[LeaveResponse]], summary="Get pending approvals for logged-in user")
def approval_queue(
    current_user: User = Depends(require_permission("approve_first", "leave")),
    db: Session = Depends(get_db),
):
    svc = LeaveService(db)
    emp_id = current_user.employee_id or 0
    role_slug = current_user.role.slug if current_user.role else ""
    return APIResponse(data=svc.get_approval_queue(user_employee_id=emp_id, role_slug=role_slug))


@router.get("/team-calendar", response_model=APIResponse[List[TeamCalendarLeaveItem]], summary="Get team leave calendar within date range")
def team_calendar(
    company_id: int = Query(default=1),
    from_date: date = Query(...),
    to_date: date = Query(...),
    current_user: User = Depends(require_permission("view", "leave")),
    db: Session = Depends(get_db),
):
    svc = LeaveService(db)
    return APIResponse(data=svc.get_team_calendar(company_id=company_id, from_date=from_date, to_date=to_date))


@router.get("", response_model=PaginatedResponse[LeaveResponse], summary="List all leaves (Admin/Manager view)")
def list_leaves(
    company_id: int = Query(default=1),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    employee_id: Optional[int] = Query(default=None),
    department_id: Optional[int] = Query(default=None),
    status_filter: Optional[LeaveStatusEnum] = Query(default=None, alias="status"),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(require_permission("view", "leave")),
    db: Session = Depends(get_db),
):
    svc = LeaveService(db)
    return svc.list_leaves(
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


@router.post("/{id}/approve-first", response_model=APIResponse[LeaveResponse], summary="First-level leave approval (Manager)")
def approve_first(
    id: int,
    payload: LeaveApprovalActionRequest,
    current_user: User = Depends(require_permission("approve_first", "leave")),
    db: Session = Depends(get_db),
):
    svc = LeaveService(db)
    emp_id = current_user.employee_id or 0
    return APIResponse(data=svc.approve_first_level(leave_id=id, actor_employee_id=emp_id, remarks=payload.remarks), message="First-level approval recorded")


@router.post("/{id}/approve-final", response_model=APIResponse[LeaveResponse], summary="Final leave approval (HR/Admin)")
def approve_final(
    id: int,
    payload: LeaveApprovalActionRequest,
    current_user: User = Depends(require_permission("approve_final", "leave")),
    db: Session = Depends(get_db),
):
    svc = LeaveService(db)
    return APIResponse(data=svc.approve_final_level(leave_id=id, actor_user_id=current_user.id, remarks=payload.remarks), message="Leave approved")


@router.post("/{id}/reject", response_model=APIResponse[LeaveResponse], summary="Reject leave request")
def reject_leave(
    id: int,
    payload: LeaveApprovalActionRequest,
    current_user: User = Depends(require_permission("approve_first", "leave")),
    db: Session = Depends(get_db),
):
    reason = payload.remarks or "Request rejected by approver"
    svc = LeaveService(db)
    return APIResponse(data=svc.reject_leave(leave_id=id, actor_user_id=current_user.id, rejection_reason=reason), message="Leave request rejected")


@router.post("/{id}/cancel", response_model=APIResponse[LeaveResponse], summary="Cancel leave request")
def cancel_leave(
    id: int,
    current_user: User = Depends(get_current_active_employee),
    db: Session = Depends(get_db),
):
    svc = LeaveService(db)
    return APIResponse(data=svc.cancel_leave(leave_id=id, employee_id=current_user.employee_id), message="Leave request cancelled")
