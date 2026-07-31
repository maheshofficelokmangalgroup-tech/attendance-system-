"""Pydantic v2 DTOs — Settings and AttendanceRules."""
from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# AttendanceRules
# ---------------------------------------------------------------------------

class AttendanceRulesUpdate(BaseModel):
    grace_period_minutes: Optional[int] = Field(None, ge=0, le=120)
    half_day_hours: Optional[float] = Field(None, ge=0)
    full_day_hours: Optional[float] = Field(None, ge=0)
    overtime_threshold_minutes: Optional[int] = Field(None, ge=0)
    comp_off_threshold_minutes: Optional[int] = Field(None, ge=0)
    allow_wfh: Optional[bool] = None
    allow_on_duty: Optional[bool] = None


class AttendanceRulesResponse(BaseModel):
    id: int
    company_id: int
    grace_period_minutes: int
    half_day_hours: float
    full_day_hours: float
    overtime_threshold_minutes: int
    comp_off_threshold_minutes: int
    allow_wfh: bool
    allow_on_duty: bool
    updated_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Generic Settings (key-value)
# ---------------------------------------------------------------------------

class SettingUpsert(BaseModel):
    key: str = Field(..., min_length=1, max_length=100)
    value: str
    group: str = Field(default="general", max_length=100)


class BulkSettingsUpsert(BaseModel):
    settings: List[SettingUpsert]


class SettingResponse(BaseModel):
    id: int
    company_id: int
    key: str
    value: str
    group: str
    updated_at: datetime
    model_config = {"from_attributes": True}
