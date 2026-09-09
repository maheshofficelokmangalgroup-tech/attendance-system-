"""
WFH Service — Apply, single-stage Approve/Reject, Cancel, and attendance sync.

Unlike Leave (two-stage manager -> HR chain, balance-tracked), a WFH request
is single-stage: any Admin/HR/Manager can approve it directly, and there's
no balance to deduct — approval just marks the requested dates' attendance
status as WFH.
"""
from __future__ import annotations
import math
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.wfh import WfhRequest, WfhStatusEnum
from app.models.attendance import Attendance, AttendanceStatusEnum
from app.models.notification import Notification
from app.repository.wfh_repo import WfhRepository
from app.repository.employee_repo import EmployeeRepository
from app.repository.company_repo import AttendanceRulesRepository
from app.repository.audit_repo import AuditRepository
from app.schemas.wfh import ApplyWfhRequest, WfhResponse, WfhEmployeeSummary
from app.schemas.common import PaginatedResponse


class WfhService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = WfhRepository(db)
        self.employee_repo = EmployeeRepository(db)
        self.rules_repo = AttendanceRulesRepository(db)
        self.audit_repo = AuditRepository(db)

    # ------------------------------------------------------------------
    # Apply
    # ------------------------------------------------------------------

    def apply(self, employee_id: int, payload: ApplyWfhRequest) -> WfhResponse:
        if payload.to_date < payload.from_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End date cannot be earlier than start date",
            )

        employee = self.employee_repo.get(employee_id)
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

        rules = self.rules_repo.get_by_company(employee.company_id)
        if rules and not rules.allow_wfh:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Work From Home requests are disabled for your company",
            )

        overlap = self.repo.check_overlapping(employee_id, payload.from_date, payload.to_date)
        if overlap:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You already have a WFH request ({overlap.from_date} to {overlap.to_date}) overlapping this date range.",
            )

        wfh = WfhRequest(
            employee_id=employee_id,
            from_date=payload.from_date,
            to_date=payload.to_date,
            reason=payload.reason,
            status=WfhStatusEnum.PENDING,
        )
        self.repo.create(wfh)
        self.db.flush()

        # Notify manager if assigned
        if employee.manager and employee.manager.user:
            self.db.add(Notification(
                user_id=employee.manager.user.id,
                employee_id=employee.manager.id,
                title="New WFH Request",
                body=f"{employee.full_name} requested Work From Home ({payload.from_date} to {payload.to_date}).",
                type="wfh_applied",
                meta={"wfh_id": wfh.id},
            ))

        self.audit_repo.log(
            user_id=employee.user.id if employee.user else None,
            action="wfh_applied",
            entity_type="WfhRequest",
            entity_id=wfh.id,
            after_data={"from_date": str(payload.from_date), "to_date": str(payload.to_date)},
        )

        self.db.commit()
        return self._build_response(wfh.id)

    # ------------------------------------------------------------------
    # Approve / Reject / Cancel
    # ------------------------------------------------------------------

    def approve(self, wfh_id: int, actor_user_id: int, actor_employee_id: Optional[int]) -> WfhResponse:
        wfh = self.repo.get_locked(wfh_id)
        if not wfh:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WFH request not found")
        if wfh.status != WfhStatusEnum.PENDING:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot approve a request in '{wfh.status.value}' status")

        wfh.status = WfhStatusEnum.APPROVED
        wfh.approver_id = actor_employee_id
        wfh.approved_at = datetime.now(timezone.utc)

        # Create/update Attendance rows for each date in range -> status WFH
        curr = wfh.from_date
        while curr <= wfh.to_date:
            att = (
                self.db.query(Attendance)
                .filter(Attendance.employee_id == wfh.employee_id, Attendance.date == curr)
                .first()
            )
            if att:
                att.status = AttendanceStatusEnum.WFH
                att.wfh_request_id = wfh.id
            else:
                att = Attendance(
                    employee_id=wfh.employee_id,
                    date=curr,
                    status=AttendanceStatusEnum.WFH,
                    wfh_request_id=wfh.id,
                    remarks="Work From Home (approved)",
                )
                self.db.add(att)
            curr += timedelta(days=1)

        if wfh.employee and wfh.employee.user:
            self.db.add(Notification(
                user_id=wfh.employee.user.id,
                employee_id=wfh.employee.id,
                title="WFH Request Approved",
                body=f"Your Work From Home request for {wfh.from_date} to {wfh.to_date} has been approved.",
                type="wfh_approved",
                meta={"wfh_id": wfh.id},
            ))

        self.audit_repo.log(
            user_id=actor_user_id,
            action="wfh_approved",
            entity_type="WfhRequest",
            entity_id=wfh.id,
        )

        self.db.commit()
        return self._build_response(wfh.id)

    def reject(self, wfh_id: int, actor_user_id: int, rejection_reason: str) -> WfhResponse:
        wfh = self.repo.get_locked(wfh_id)
        if not wfh:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WFH request not found")
        if wfh.status != WfhStatusEnum.PENDING:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot reject a request in '{wfh.status.value}' status")

        wfh.status = WfhStatusEnum.REJECTED
        wfh.rejection_reason = rejection_reason

        if wfh.employee and wfh.employee.user:
            self.db.add(Notification(
                user_id=wfh.employee.user.id,
                employee_id=wfh.employee.id,
                title="WFH Request Rejected",
                body=f"Your Work From Home request ({wfh.from_date} to {wfh.to_date}) was rejected: {rejection_reason}",
                type="wfh_rejected",
                meta={"wfh_id": wfh.id},
            ))

        self.audit_repo.log(
            user_id=actor_user_id,
            action="wfh_rejected",
            entity_type="WfhRequest",
            entity_id=wfh.id,
            after_data={"reason": rejection_reason},
        )

        self.db.commit()
        return self._build_response(wfh.id)

    def cancel(self, wfh_id: int, employee_id: int) -> WfhResponse:
        wfh = self.repo.get_locked(wfh_id)
        if not wfh:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WFH request not found")
        if wfh.employee_id != employee_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only cancel your own WFH requests")
        if wfh.status in (WfhStatusEnum.CANCELLED, WfhStatusEnum.REJECTED):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Request is already {wfh.status.value}")

        if wfh.status == WfhStatusEnum.APPROVED:
            # Clear linked attendance records so the day reverts to unmarked
            self.db.query(Attendance).filter(Attendance.wfh_request_id == wfh.id).delete()

        wfh.status = WfhStatusEnum.CANCELLED
        self.audit_repo.log(
            user_id=employee_id,
            action="wfh_cancelled",
            entity_type="WfhRequest",
            entity_id=wfh.id,
        )

        self.db.commit()
        return self._build_response(wfh.id)

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    def list_my(self, employee_id: int, page: int = 1, page_size: int = 20) -> PaginatedResponse[WfhResponse]:
        return self.list_all(company_id=1, page=page, page_size=page_size, employee_id=employee_id)

    def list_all(
        self,
        company_id: int,
        page: int = 1,
        page_size: int = 20,
        employee_id: Optional[int] = None,
        department_id: Optional[int] = None,
        status_filter: Optional[WfhStatusEnum] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        search: Optional[str] = None,
    ) -> PaginatedResponse[WfhResponse]:
        skip = (page - 1) * page_size
        items, total = self.repo.list_paginated(
            company_id=company_id,
            skip=skip,
            limit=page_size,
            employee_id=employee_id,
            department_id=department_id,
            status=status_filter,
            from_date=from_date,
            to_date=to_date,
            search=search,
        )
        return PaginatedResponse(
            data=[self._build_response(w.id) for w in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 0,
        )

    def list_pending(self, company_id: int) -> List[WfhResponse]:
        return [self._build_response(w.id) for w in self.repo.list_pending(company_id)]

    # ------------------------------------------------------------------
    # Internal helper
    # ------------------------------------------------------------------

    def _build_response(self, wfh_id: int) -> WfhResponse:
        wfh = self.repo.get_with_details(wfh_id)
        if not wfh:
            raise HTTPException(status_code=404, detail="WFH request not found")

        resp = WfhResponse.model_validate(wfh)
        if wfh.employee:
            resp.employee = WfhEmployeeSummary(
                id=wfh.employee.id,
                employee_code=wfh.employee.employee_code,
                first_name=wfh.employee.first_name,
                last_name=wfh.employee.last_name,
                full_name=wfh.employee.full_name,
                email=wfh.employee.email,
                department_name=wfh.employee.department.name if wfh.employee.department else None,
            )
        resp.status = wfh.status.value
        return resp
