"""Employee repository."""
from __future__ import annotations
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.models.employee import Employee
from app.repository.base import BaseRepository


class EmployeeRepository(BaseRepository[Employee]):
    def __init__(self, db: Session):
        super().__init__(Employee, db)

    def get_with_details(self, employee_id: int) -> Optional[Employee]:
        return (
            self.db.query(Employee)
            .options(
                joinedload(Employee.department),
                joinedload(Employee.designation),
                joinedload(Employee.shift),
                joinedload(Employee.user),
            )
            .filter(Employee.id == employee_id)
            .first()
        )

    def get_by_email(self, email: str) -> Optional[Employee]:
        return self.db.query(Employee).filter(Employee.email == email.lower()).first()

    def get_by_code(self, code: str) -> Optional[Employee]:
        return self.db.query(Employee).filter(Employee.employee_code == code).first()

    def list_paginated(
        self,
        company_id: int,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        department_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> Tuple[List[Employee], int]:
        q = (
            self.db.query(Employee)
            .options(
                joinedload(Employee.department),
                joinedload(Employee.designation),
            )
            .filter(Employee.company_id == company_id)
        )
        if search:
            term = f"%{search}%"
            q = q.filter(
                or_(
                    Employee.first_name.ilike(term),
                    Employee.last_name.ilike(term),
                    Employee.email.ilike(term),
                    Employee.employee_code.ilike(term),
                )
            )
        if department_id is not None:
            q = q.filter(Employee.department_id == department_id)
        if is_active is not None:
            q = q.filter(Employee.is_active == is_active)

        total = q.count()
        items = q.order_by(Employee.first_name).offset(skip).limit(limit).all()
        return items, total

    def get_team(self, manager_id: int) -> List[Employee]:
        """Direct reports of a manager — used for scope checks."""
        return (
            self.db.query(Employee)
            .filter(Employee.manager_id == manager_id, Employee.is_active == True)  # noqa
            .all()
        )
