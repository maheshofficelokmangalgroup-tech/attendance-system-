"""Leave Repository — Leaves, Balances, CompOffs."""
from __future__ import annotations
from datetime import date, datetime
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func

from app.models.leave import Leave, LeaveBalance, LeaveType, CompOff, LeaveStatusEnum, LeaveApprovalStatusEnum
from app.models.employee import Employee
from app.repository.base import BaseRepository


class LeaveRepository(BaseRepository[Leave]):
    def __init__(self, db: Session):
        super().__init__(Leave, db)

    # ------------------------------------------------------------------
    # Leave Balances
    # ------------------------------------------------------------------

    def get_balances(self, employee_id: int, year: int) -> List[LeaveBalance]:
        return (
            self.db.query(LeaveBalance)
            .options(joinedload(LeaveBalance.leave_type))
            .filter(
                LeaveBalance.employee_id == employee_id,
                LeaveBalance.year == year,
            )
            .all()
        )

    def get_balance_for_type(self, employee_id: int, leave_type_id: int, year: int) -> Optional[LeaveBalance]:
        return (
            self.db.query(LeaveBalance)
            .filter(
                LeaveBalance.employee_id == employee_id,
                LeaveBalance.leave_type_id == leave_type_id,
                LeaveBalance.year == year,
            )
            .first()
        )

    def get_balance_for_type_locked(self, employee_id: int, leave_type_id: int, year: int) -> Optional[LeaveBalance]:
        return (
            self.db.query(LeaveBalance)
            .filter(
                LeaveBalance.employee_id == employee_id,
                LeaveBalance.leave_type_id == leave_type_id,
                LeaveBalance.year == year,
            )
            .with_for_update()
            .first()
        )

    def get_or_create_balance(self, employee_id: int, leave_type_id: int, year: int, default_days: float) -> LeaveBalance:
        bal = self.get_balance_for_type(employee_id, leave_type_id, year)
        if not bal:
            bal = LeaveBalance(
                employee_id=employee_id,
                leave_type_id=leave_type_id,
                year=year,
                total_days=default_days,
                used_days=0.0,
                balance_days=default_days,
            )
            self.db.add(bal)
            self.db.flush()
        return bal

    # ------------------------------------------------------------------
    # Leaves
    # ------------------------------------------------------------------

    def get_with_details(self, leave_id: int) -> Optional[Leave]:
        return (
            self.db.query(Leave)
            .options(
                joinedload(Leave.employee).joinedload(Employee.department),
                joinedload(Leave.leave_type),
            )
            .filter(Leave.id == leave_id)
            .first()
        )

    def check_overlapping_leave(self, employee_id: int, from_date: date, to_date: date, exclude_id: Optional[int] = None) -> Optional[Leave]:
        """Check if employee has an active/pending leave overlapping the requested date range."""
        q = (
            self.db.query(Leave)
            .filter(
                Leave.employee_id == employee_id,
                Leave.status.in_([
                    LeaveStatusEnum.PENDING,
                    LeaveStatusEnum.FIRST_APPROVED,
                    LeaveStatusEnum.APPROVED,
                ]),
                or_(
                    and_(Leave.from_date <= from_date, Leave.to_date >= from_date),
                    and_(Leave.from_date <= to_date, Leave.to_date >= to_date),
                    and_(Leave.from_date >= from_date, Leave.to_date <= to_date),
                ),
            )
        )
        if exclude_id:
            q = q.filter(Leave.id != exclude_id)
        return q.first()

    def list_paginated(
        self,
        company_id: int,
        skip: int = 0,
        limit: int = 20,
        employee_id: Optional[int] = None,
        department_id: Optional[int] = None,
        status: Optional[LeaveStatusEnum] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Leave], int]:
        q = (
            self.db.query(Leave)
            .join(Employee, Leave.employee_id == Employee.id)
            .options(
                joinedload(Leave.employee).joinedload(Employee.department),
                joinedload(Leave.leave_type),
            )
            .filter(Employee.company_id == company_id)
        )

        if employee_id is not None:
            q = q.filter(Leave.employee_id == employee_id)
        if department_id is not None:
            q = q.filter(Employee.department_id == department_id)
        if status is not None:
            q = q.filter(Leave.status == status)
        if from_date is not None:
            q = q.filter(Leave.to_date >= from_date)
        if to_date is not None:
            q = q.filter(Leave.from_date <= to_date)
        if search:
            term = f"%{search}%"
            q = q.filter(
                or_(
                    Employee.first_name.ilike(term),
                    Employee.last_name.ilike(term),
                    Employee.employee_code.ilike(term),
                )
            )

        total = q.count()
        items = q.order_by(Leave.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    def list_approval_queue(
        self,
        approver_employee_id: int,
        is_hr_or_admin: bool = False,
    ) -> List[Leave]:
        """
        Returns pending approvals for logged-in user:
        - If Manager: returns leaves where first_approver_id == approver_id and status == PENDING
        - If HR/Admin: returns leaves where status == FIRST_APPROVED or (status == PENDING and first_approver_id is None)
        """
        if is_hr_or_admin:
            return (
                self.db.query(Leave)
                .options(
                    joinedload(Leave.employee).joinedload(Employee.department),
                    joinedload(Leave.leave_type),
                )
                .filter(
                    or_(
                        Leave.status == LeaveStatusEnum.FIRST_APPROVED,
                        and_(Leave.status == LeaveStatusEnum.PENDING, Leave.first_approver_id.is_(None)),
                    )
                )
                .order_by(Leave.created_at.desc())
                .all()
            )
        else:
            return (
                self.db.query(Leave)
                .options(
                    joinedload(Leave.employee).joinedload(Employee.department),
                    joinedload(Leave.leave_type),
                )
                .filter(
                    Leave.first_approver_id == approver_employee_id,
                    Leave.status == LeaveStatusEnum.PENDING,
                )
                .order_by(Leave.created_at.desc())
                .all()
            )

    def get_team_calendar(self, company_id: int, from_date: date, to_date: date) -> List[Leave]:
        """Fetch all approved/pending leaves within date range for team calendar."""
        return (
            self.db.query(Leave)
            .join(Employee, Leave.employee_id == Employee.id)
            .options(
                joinedload(Leave.employee).joinedload(Employee.department),
                joinedload(Leave.leave_type),
            )
            .filter(
                Employee.company_id == company_id,
                Leave.status.in_([LeaveStatusEnum.APPROVED, LeaveStatusEnum.FIRST_APPROVED]),
                Leave.from_date <= to_date,
                Leave.to_date >= from_date,
            )
            .all()
        )

    # ------------------------------------------------------------------
    # Comp-Offs
    # ------------------------------------------------------------------

    def get_comp_offs(self, employee_id: int) -> List[CompOff]:
        return (
            self.db.query(CompOff)
            .filter(CompOff.employee_id == employee_id)
            .order_by(CompOff.earned_date.desc())
            .all()
        )
