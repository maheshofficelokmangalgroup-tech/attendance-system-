"""Holidays router — /api/v1/holidays"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.models.user import User
from app.services.company_service import CompanyService
from app.schemas.leave import HolidayCreate, HolidayUpdate, HolidayResponse
from app.schemas.common import APIResponse

router = APIRouter(prefix="/holidays", tags=["Holidays"])


@router.post("", response_model=APIResponse[HolidayResponse], summary="Create holiday")
def create_holiday(payload: HolidayCreate, current_user: User = Depends(require_permission("manage", "holiday")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).create_holiday(payload, current_user.id))


@router.get("", response_model=APIResponse[List[HolidayResponse]], summary="List holidays by company")
def list_holidays(company_id: int, current_user: User = Depends(require_permission("view", "holiday")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).list_holidays(company_id))


@router.put("/{holiday_id}", response_model=APIResponse[HolidayResponse], summary="Update holiday")
def update_holiday(holiday_id: int, payload: HolidayUpdate, current_user: User = Depends(require_permission("manage", "holiday")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).update_holiday(holiday_id, payload, current_user.id))


@router.delete("/{holiday_id}", response_model=APIResponse[None], summary="Delete holiday")
def delete_holiday(holiday_id: int, current_user: User = Depends(require_permission("manage", "holiday")), db: Session = Depends(get_db)):
    CompanyService(db).delete_holiday(holiday_id, current_user.id)
    return APIResponse(message="Holiday deleted")
