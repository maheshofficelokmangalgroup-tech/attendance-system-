"""
Leave Service — Balances, Accruals, Multi-Stage Approval Chain, LWP Fallback, Team Calendar.
"""
from __future__ import annotations
import math
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.leave import (
    Leave, LeaveBalance, LeaveType, LeaveStatusEnum,
    LeaveApprovalStatusEnum, CompOff, AccrualTypeEnum,
)
from app.models.attendance import Attendance, AttendanceStatusEnum
from app.models.notification import Notification
from app.repository.leave_repo import LeaveRepository
from app.repository.employee_repo import EmployeeRepository
from app.repository.company_repo import CompanyRepository
from app.repository.audit_repo import AuditRepository
from app.schemas.leave import (
    ApplyLeaveRequest, LeaveResponse, LeaveBalanceResponse,
    TeamCalendarLeaveItem, LeaveEmployeeSummary, LeaveTypeResponse,
)
from app.schemas.common import PaginatedResponse
from app.utils.timezone import today_ist


class LeaveService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = LeaveRepository(db)
        self.employee_repo = EmployeeRepository(db)
        self.company_repo = CompanyRepository(db)
        self.audit_repo = AuditRepository(db)

    # ------------------------------------------------------------------
    # Balances & Accruals
    # ------------------------------------------------------------------

    def get_my_balances(self, employee_id: int, year: Optional[int] = None) -> List[LeaveBalanceResponse]:
        if year is None:
            year = today_ist().year

        employee = self.employee_repo.get(employee_id)
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

        # Auto-initialize balances for active leave types if not yet created for this year
        leave_types = (
            self.db.query(LeaveType)
            .filter(LeaveType.company_id == employee.company_id, LeaveType.is_active == True)  # noqa
            .all()
        )
        for lt in leave_types:
            self.repo.get_or_create_balance(employee_id, lt.id, year, float(lt.days_per_year))
        self.db.commit()

        balances = self.repo.get_balances(employee_id, year)
        results = []
        for b in balances:
            res = LeaveBalanceResponse.model_validate(b)
            if b.leave_type:
                res.leave_type_name = b.leave_type.name
                res.leave_type_code = b.leave_type.code
            results.append(res)
        return results

    # ------------------------------------------------------------------
    # Apply Leave
    # ------------------------------------------------------------------

    def apply_leave(self, employee_id: int, payload: ApplyLeaveRequest) -> LeaveResponse:
        if payload.to_date < payload.from_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End date cannot be earlier than start date",
            )

        employee = self.employee_repo.get(employee_id)
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

        # 1. Overlap check
        overlap = self.repo.check_overlapping_leave(employee_id, payload.from_date, payload.to_date)
        if overlap:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You already have a leave request ({overlap.from_date} to {overlap.to_date}) overlapping this date range.",
            )

        # 2. Leave type & balance check
        lt = self.db.get(LeaveType, payload.leave_type_id)
        if not lt or not lt.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid leave type")

        year = payload.from_date.year
        balance_entry = self.repo.get_or_create_balance(employee_id, lt.id, year, float(lt.days_per_year))

        # Check balance if leave type is paid & requires balance
        effective_leave_type = lt
        used_lwp_fallback = False
        if lt.is_paid and float(balance_entry.balance_days) < payload.total_days:
            # Fall back to LWP: redirect the request onto the LWP leave type
            # instead of creating it against the (insufficient) original type.
            lwp_type = (
                self.db.query(LeaveType)
                .filter(LeaveType.company_id == employee.company_id, LeaveType.code == "LWP")
                .first()
            )
            if not lwp_type:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient {lt.name} balance. Available: {balance_entry.balance_days} days, Requested: {payload.total_days} days.",
                )
            effective_leave_type = lwp_type
            used_lwp_fallback = True

        # 3. Create Leave record
        leave = Leave(
            employee_id=employee_id,
            leave_type_id=effective_leave_type.id,
            from_date=payload.from_date,
            to_date=payload.to_date,
            total_days=payload.total_days,
            reason=payload.reason,
            status=LeaveStatusEnum.PENDING,
            applied_by=employee_id,
            first_approver_id=employee.manager_id,
            first_approval_status=LeaveApprovalStatusEnum.PENDING,
            final_approval_status=LeaveApprovalStatusEnum.PENDING,
        )
        self.repo.create(leave)
        self.db.flush()

        # 4. Notify Manager if assigned
        if employee.manager and employee.manager.user:
            lwp_note = " (auto-converted to Leave Without Pay — insufficient balance)" if used_lwp_fallback else ""
            noti = Notification(
                user_id=employee.manager.user.id,
                employee_id=employee.manager.id,
                title="New Leave Request",
                body=f"{employee.full_name} applied for {payload.total_days} day(s) {effective_leave_type.name}{lwp_note} ({payload.from_date} to {payload.to_date}).",
                type="leave_applied",
                meta={"leave_id": leave.id},
            )
            self.db.add(noti)

        self.audit_repo.log(
            user_id=employee.user.id if employee.user else None,
            action="leave_applied",
            entity_type="Leave",
            entity_id=leave.id,
            after_data={"from_date": str(payload.from_date), "to_date": str(payload.to_date), "days": payload.total_days},
        )

        self.db.commit()
        return self._build_leave_response(leave.id)

    # ------------------------------------------------------------------
    # Approval Chain: Manager (First) → HR/Admin (Final)
    # ------------------------------------------------------------------

    def approve_first_level(
        self, leave_id: int, actor_user_id: int, actor_employee_id: Optional[int], remarks: Optional[str] = None
    ) -> LeaveResponse:
        leave = self.repo.get_locked(leave_id)
        if not leave:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

        if leave.status != LeaveStatusEnum.PENDING:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot approve leave in '{leave.status.value}' status")

        # first_approver_id is a FK to employees.id — nullable, since an
        # approving Admin/HR user doesn't necessarily have an employee profile.
        leave.first_approver_id = actor_employee_id
        leave.first_approval_status = LeaveApprovalStatusEnum.APPROVED
        leave.first_approval_at = datetime.now(timezone.utc)
        leave.status = LeaveStatusEnum.FIRST_APPROVED

        # Notify Employee
        if leave.employee and leave.employee.user:
            self.db.add(Notification(
                user_id=leave.employee.user.id,
                employee_id=leave.employee.id,
                title="Leave Recommendation Approved",
                body=f"Your manager has approved your leave request ({leave.from_date} to {leave.to_date}). Pending HR final approval.",
                type="leave_first_approved",
                meta={"leave_id": leave.id},
            ))

        self.audit_repo.log(
            user_id=actor_user_id,
            action="leave_first_approved",
            entity_type="Leave",
            entity_id=leave.id,
        )

        self.db.commit()
        return self._build_leave_response(leave.id)

    def approve_final_level(
        self, leave_id: int, actor_user_id: int, actor_employee_id: Optional[int], remarks: Optional[str] = None
    ) -> LeaveResponse:
        leave = self.repo.get_locked(leave_id)
        if not leave:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

        # Strict two-stage chain: HR/Admin can only give final approval once the
        # manager has given first-level approval. The only exception is when the
        # employee has no manager assigned at all (first_approver_id is None),
        # in which case HR/Admin stands in for the missing first stage.
        skip_first_stage = leave.first_approver_id is None
        if leave.status == LeaveStatusEnum.FIRST_APPROVED:
            pass
        elif leave.status == LeaveStatusEnum.PENDING and skip_first_stage:
            pass
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot perform final approval on leave in '{leave.status.value}' status "
                       f"— manager first-level approval is required first",
            )

        # final_approver_id is a FK to employees.id — nullable, since an
        # approving Admin/HR user doesn't necessarily have an employee profile.
        leave.final_approver_id = actor_employee_id
        leave.final_approval_status = LeaveApprovalStatusEnum.APPROVED
        leave.final_approval_at = datetime.now(timezone.utc)
        leave.status = LeaveStatusEnum.APPROVED

        # Deduct balance
        year = leave.from_date.year
        bal = self.repo.get_balance_for_type_locked(leave.employee_id, leave.leave_type_id, year)
        if bal:
            bal.used_days = float(bal.used_days) + float(leave.total_days)
            bal.balance_days = max(0.0, float(bal.total_days) - float(bal.used_days))

        # Create/Update Attendance records for dates in range -> status ON_LEAVE
        curr = leave.from_date
        while curr <= leave.to_date:
            att = (
                self.db.query(Attendance)
                .filter(Attendance.employee_id == leave.employee_id, Attendance.date == curr)
                .first()
            )
            leave_status_enum = AttendanceStatusEnum.ON_LEAVE if leave.leave_type.is_paid else AttendanceStatusEnum.LWP
            if att:
                att.status = leave_status_enum
                att.leave_id = leave.id
            else:
                att = Attendance(
                    employee_id=leave.employee_id,
                    date=curr,
                    status=leave_status_enum,
                    leave_id=leave.id,
                    remarks=f"On Leave ({leave.leave_type.code})",
                )
                self.db.add(att)
            curr += timedelta(days=1)

        # Notify Employee
        if leave.employee and leave.employee.user:
            self.db.add(Notification(
                user_id=leave.employee.user.id,
                employee_id=leave.employee.id,
                title="Leave Approved",
                body=f"Your leave request for {leave.from_date} to {leave.to_date} has been fully approved.",
                type="leave_approved",
                meta={"leave_id": leave.id},
            ))

        self.audit_repo.log(
            user_id=actor_user_id,
            action="leave_final_approved",
            entity_type="Leave",
            entity_id=leave.id,
        )

        self.db.commit()
        return self._build_leave_response(leave.id)

    def reject_leave(self, leave_id: int, actor_user_id: int, rejection_reason: str) -> LeaveResponse:
        leave = self.repo.get_locked(leave_id)
        if not leave:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

        if leave.status not in (LeaveStatusEnum.PENDING, LeaveStatusEnum.FIRST_APPROVED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reject leave in '{leave.status.value}' status",
            )

        leave.status = LeaveStatusEnum.REJECTED
        leave.rejection_reason = rejection_reason

        # Notify Employee
        if leave.employee and leave.employee.user:
            self.db.add(Notification(
                user_id=leave.employee.user.id,
                employee_id=leave.employee.id,
                title="Leave Request Rejected",
                body=f"Your leave request ({leave.from_date} to {leave.to_date}) was rejected: {rejection_reason}",
                type="leave_rejected",
                meta={"leave_id": leave.id},
            ))

        self.audit_repo.log(
            user_id=actor_user_id,
            action="leave_rejected",
            entity_type="Leave",
            entity_id=leave.id,
            after_data={"reason": rejection_reason},
        )

        self.db.commit()
        return self._build_leave_response(leave.id)

    def cancel_leave(self, leave_id: int, employee_id: int) -> LeaveResponse:
        leave = self.repo.get_locked(leave_id)
        if not leave:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")

        if leave.employee_id != employee_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only cancel your own leave requests")

        if leave.status in (LeaveStatusEnum.CANCELLED, LeaveStatusEnum.REJECTED):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Leave is already {leave.status.value}")

        # If it was approved, restore balance & clear attendance records
        if leave.status == LeaveStatusEnum.APPROVED:
            year = leave.from_date.year
            bal = self.repo.get_balance_for_type_locked(leave.employee_id, leave.leave_type_id, year)
            if bal:
                bal.used_days = max(0.0, float(bal.used_days) - float(leave.total_days))
                bal.balance_days = float(bal.total_days) - float(bal.used_days)

            # Clear linked attendance records
            self.db.query(Attendance).filter(Attendance.leave_id == leave.id).delete()

        leave.status = LeaveStatusEnum.CANCELLED
        self.audit_repo.log(
            user_id=employee_id,
            action="leave_cancelled",
            entity_type="Leave",
            entity_id=leave.id,
        )

        self.db.commit()
        return self._build_leave_response(leave.id)

    # ------------------------------------------------------------------
    # Query & Calendar
    # ------------------------------------------------------------------

    def list_leaves(
        self,
        company_id: int,
        page: int = 1,
        page_size: int = 20,
        employee_id: Optional[int] = None,
        department_id: Optional[int] = None,
        status_filter: Optional[LeaveStatusEnum] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        search: Optional[str] = None,
    ) -> PaginatedResponse[LeaveResponse]:
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
            data=[self._build_leave_response(l.id) for l in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 0,
        )

    def get_approval_queue(self, user_employee_id: Optional[int], role_slug: str) -> List[LeaveResponse]:
        is_hr_or_admin = role_slug in ("admin", "hr")
        leaves = self.repo.list_approval_queue(user_employee_id, is_hr_or_admin=is_hr_or_admin)
        return [self._build_leave_response(l.id) for l in leaves]

    def get_team_calendar(self, company_id: int, from_date: date, to_date: date) -> List[TeamCalendarLeaveItem]:
        leaves = self.repo.get_team_calendar(company_id, from_date, to_date)
        result = []
        for l in leaves:
            result.append(
                TeamCalendarLeaveItem(
                    id=l.id,
                    employee_id=l.employee_id,
                    employee_name=l.employee.full_name if l.employee else f"Employee #{l.employee_id}",
                    department_name=l.employee.department.name if l.employee and l.employee.department else None,
                    leave_type_code=l.leave_type.code if l.leave_type else "LEAVE",
                    leave_type_name=l.leave_type.name if l.leave_type else "Leave",
                    from_date=l.from_date,
                    to_date=l.to_date,
                    total_days=float(l.total_days),
                    status=l.status.value,
                )
            )
        return result

    # ------------------------------------------------------------------
    # Internal helper
    # ------------------------------------------------------------------

    def _build_leave_response(self, leave_id: int) -> LeaveResponse:
        leave = self.repo.get_with_details(leave_id)
        if not leave:
            raise HTTPException(status_code=404, detail="Leave not found")

        resp = LeaveResponse.model_validate(leave)
        if leave.employee:
            resp.employee = LeaveEmployeeSummary(
                id=leave.employee.id,
                employee_code=leave.employee.employee_code,
                first_name=leave.employee.first_name,
                last_name=leave.employee.last_name,
                full_name=leave.employee.full_name,
                email=leave.employee.email,
                department_name=leave.employee.department.name if leave.employee.department else None,
            )
        if leave.leave_type:
            resp.leave_type = LeaveTypeResponse.model_validate(leave.leave_type)

        resp.status = leave.status.value
        resp.first_approval_status = leave.first_approval_status.value
        resp.final_approval_status = leave.final_approval_status.value
        return resp
