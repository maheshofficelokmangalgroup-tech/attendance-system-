"""Settings router — /api/v1/settings (AttendanceRules + key-value settings)"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.models.user import User
from app.services.settings_service import SettingsService
from app.schemas.settings import (
    AttendanceRulesUpdate, AttendanceRulesResponse,
    BulkSettingsUpsert, SettingResponse,
)
from app.schemas.common import APIResponse

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get(
    "/attendance-rules/{company_id}",
    response_model=APIResponse[AttendanceRulesResponse],
    summary="Get attendance rules for a company",
)
def get_attendance_rules(
    company_id: int,
    current_user: User = Depends(require_permission("manage", "attendance_rules")),
    db: Session = Depends(get_db),
):
    return APIResponse(data=SettingsService(db).get_attendance_rules(company_id))


@router.put(
    "/attendance-rules/{company_id}",
    response_model=APIResponse[AttendanceRulesResponse],
    summary="Update attendance rules",
)
def update_attendance_rules(
    company_id: int,
    payload: AttendanceRulesUpdate,
    current_user: User = Depends(require_permission("manage", "attendance_rules")),
    db: Session = Depends(get_db),
):
    svc = SettingsService(db)
    return APIResponse(data=svc.update_attendance_rules(company_id, payload, current_user.id))


@router.get(
    "/{company_id}",
    response_model=APIResponse[List[SettingResponse]],
    summary="Get settings by group",
)
def get_settings(
    company_id: int,
    group: str = "general",
    current_user: User = Depends(require_permission("manage", "system_settings")),
    db: Session = Depends(get_db),
):
    return APIResponse(data=SettingsService(db).get_settings_by_group(company_id, group))


@router.post(
    "/{company_id}",
    response_model=APIResponse[List[SettingResponse]],
    summary="Bulk upsert settings",
)
def upsert_settings(
    company_id: int,
    payload: BulkSettingsUpsert,
    current_user: User = Depends(require_permission("manage", "system_settings")),
    db: Session = Depends(get_db),
):
    svc = SettingsService(db)
    return APIResponse(data=svc.upsert_settings(company_id, payload, current_user.id))
