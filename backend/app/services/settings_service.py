"""Settings service — AttendanceRules + generic key-value Settings."""
from __future__ import annotations
from typing import Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company import AttendanceRules
from app.models.settings import Settings
from app.repository.company_repo import AttendanceRulesRepository
from app.repository.audit_repo import AuditRepository
from app.schemas.settings import (
    AttendanceRulesUpdate, AttendanceRulesResponse,
    SettingUpsert, SettingResponse, BulkSettingsUpsert,
)


class SettingsService:
    def __init__(self, db: Session):
        self.db = db
        self.rules_repo = AttendanceRulesRepository(db)
        self.audit_repo = AuditRepository(db)

    # ------------------------------------------------------------------
    # Attendance Rules
    # ------------------------------------------------------------------

    def get_attendance_rules(self, company_id: int) -> AttendanceRulesResponse:
        rules = self.rules_repo.get_by_company(company_id)
        if not rules:
            # Auto-create with defaults on first fetch
            rules = AttendanceRules(company_id=company_id)
            self.rules_repo.create(rules)
            self.db.commit()
            self.db.refresh(rules)
        return AttendanceRulesResponse.model_validate(rules)

    def update_attendance_rules(
        self, company_id: int, payload: AttendanceRulesUpdate, actor_id: int
    ) -> AttendanceRulesResponse:
        rules = self.rules_repo.get_by_company(company_id)
        if not rules:
            rules = AttendanceRules(company_id=company_id)
            self.rules_repo.create(rules)
            self.db.flush()

        for field, val in payload.model_dump(exclude_unset=True).items():
            setattr(rules, field, val)

        self.audit_repo.log(
            user_id=actor_id,
            action="attendance_rules_updated",
            entity_type="AttendanceRules",
            entity_id=rules.id,
            after_data=payload.model_dump(exclude_unset=True),
        )
        self.db.commit()
        self.db.refresh(rules)
        return AttendanceRulesResponse.model_validate(rules)

    # ------------------------------------------------------------------
    # Generic key-value settings
    # ------------------------------------------------------------------

    def get_settings_by_group(self, company_id: int, group: str) -> List[SettingResponse]:
        items = (
            self.db.query(Settings)
            .filter(Settings.company_id == company_id, Settings.group == group)
            .all()
        )
        return [SettingResponse.model_validate(s) for s in items]

    def upsert_settings(
        self, company_id: int, payload: BulkSettingsUpsert, actor_id: int
    ) -> List[SettingResponse]:
        results = []
        for item in payload.settings:
            existing = (
                self.db.query(Settings)
                .filter(Settings.company_id == company_id, Settings.key == item.key)
                .first()
            )
            if existing:
                existing.value = item.value
                existing.group = item.group
            else:
                existing = Settings(
                    company_id=company_id,
                    key=item.key,
                    value=item.value,
                    group=item.group,
                )
                self.db.add(existing)
            self.db.flush()
            results.append(SettingResponse.model_validate(existing))

        self.audit_repo.log(
            user_id=actor_id,
            action="settings_updated",
            entity_type="Settings",
            after_data={"keys": [s.key for s in payload.settings]},
        )
        self.db.commit()
        return results
