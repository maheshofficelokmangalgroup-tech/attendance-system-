"""WFH Repository — Work From Home requests."""
from __future__ import annotations
from datetime import date
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_

from app.models.wfh import WfhRequest, WfhStatusEnum
from app.models.employee import Employee
from app.repository.base import BaseRepository


class WfhRepository(BaseRepository[WfhRequest]):
    def __init__(self, db: Session):
        super().__init__(WfhRequest, db)

    def get_with_details(self, wfh_id: int) -> Optional[WfhRequest]:
        return (
            self.db.query(WfhRequest)
            .options(joinedload(WfhRequest.employee).joinedload(Employee.department))
            .filter(WfhRequest.id == wfh_id)
            .first()
        )

    def check_overlapping(
        self, employee_id: int, from_date: date, to_date: date, exclude_id: Optional[int] = None
    ) -> Optional[WfhRequest]:
        """Check if employee has an active/pending WFH request overlapping the requested date range."""
        q = self.db.query(WfhRequest).filter(
            WfhRequest.employee_id == employee_id,
            WfhRequest.status.in_([WfhStatusEnum.PENDING, WfhStatusEnum.APPROVED]),
            or_(
                and_(WfhRequest.from_date <= from_date, WfhRequest.to_date >= from_date),
                and_(WfhRequest.from_date <= to_date, WfhRequest.to_date >= to_date),
                and_(WfhRequest.from_date >= from_date, WfhRequest.to_date <= to_date),
            ),
        )
        if exclude_id:
            q = q.filter(WfhRequest.id != exclude_id)
        return q.first()

    def list_paginated(
        self,
        company_id: int,
        skip: int = 0,
        limit: int = 20,
        employee_id: Optional[int] = None,
        department_id: Optional[int] = None,
        status: Optional[WfhStatusEnum] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[WfhRequest], int]:
        q = (
            self.db.query(WfhRequest)
            .join(Employee, WfhRequest.employee_id == Employee.id)
            .options(joinedload(WfhRequest.employee).joinedload(Employee.department))
            .filter(Employee.company_id == company_id)
        )

        if employee_id is not None:
            q = q.filter(WfhRequest.employee_id == employee_id)
        if department_id is not None:
            q = q.filter(Employee.department_id == department_id)
        if status is not None:
            q = q.filter(WfhRequest.status == status)
        if from_date is not None:
            q = q.filter(WfhRequest.to_date >= from_date)
        if to_date is not None:
            q = q.filter(WfhRequest.from_date <= to_date)
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
        items = q.order_by(WfhRequest.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    def list_pending(self, company_id: int) -> List[WfhRequest]:
        return (
            self.db.query(WfhRequest)
            .join(Employee, WfhRequest.employee_id == Employee.id)
            .options(joinedload(WfhRequest.employee).joinedload(Employee.department))
            .filter(Employee.company_id == company_id, WfhRequest.status == WfhStatusEnum.PENDING)
            .order_by(WfhRequest.created_at.desc())
            .all()
        )
