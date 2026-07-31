"""Leave Types router — /api/v1/leave-types"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.models.user import User
from app.services.company_service import CompanyService
from app.schemas.leave import LeaveTypeCreate, LeaveTypeUpdate, LeaveTypeResponse
from app.schemas.common import APIResponse

router = APIRouter(prefix="/leave-types", tags=["Leave Types"])


@router.post("", response_model=APIResponse[LeaveTypeResponse], summary="Create leave type")
def create_leave_type(payload: LeaveTypeCreate, current_user: User = Depends(require_permission("manage", "leave_type")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).create_leave_type(payload, current_user.id))


@router.get("", response_model=APIResponse[List[LeaveTypeResponse]], summary="List leave types by company")
def list_leave_types(company_id: int, current_user: User = Depends(require_permission("view", "leave_type")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).list_leave_types(company_id))


@router.put("/{lt_id}", response_model=APIResponse[LeaveTypeResponse], summary="Update leave type")
def update_leave_type(lt_id: int, payload: LeaveTypeUpdate, current_user: User = Depends(require_permission("manage", "leave_type")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).update_leave_type(lt_id, payload, current_user.id))


@router.delete("/{lt_id}", response_model=APIResponse[None], summary="Deactivate leave type")
def delete_leave_type(lt_id: int, current_user: User = Depends(require_permission("manage", "leave_type")), db: Session = Depends(get_db)):
    CompanyService(db).delete_leave_type(lt_id, current_user.id)
    return APIResponse(message="Leave type deactivated")
