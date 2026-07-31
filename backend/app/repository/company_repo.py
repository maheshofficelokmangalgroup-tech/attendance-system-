"""Company aggregate repository — Companies, Departments, Designations, Shifts."""
from __future__ import annotations
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.company import Company, Department, Designation, Shift, AttendanceRules
from app.repository.base import BaseRepository


class CompanyRepository(BaseRepository[Company]):
    def __init__(self, db: Session):
        super().__init__(Company, db)

    def get_active(self) -> List[Company]:
        return self.db.query(Company).filter(Company.is_active == True).all()  # noqa


class DepartmentRepository(BaseRepository[Department]):
    def __init__(self, db: Session):
        super().__init__(Department, db)

    def list_by_company(self, company_id: int, skip: int = 0, limit: int = 100) -> Tuple[List[Department], int]:
        q = self.db.query(Department).filter(Department.company_id == company_id)
        total = q.count()
        return q.offset(skip).limit(limit).all(), total

    def get_by_name(self, company_id: int, name: str) -> Optional[Department]:
        return (
            self.db.query(Department)
            .filter(Department.company_id == company_id, Department.name == name)
            .first()
        )


class DesignationRepository(BaseRepository[Designation]):
    def __init__(self, db: Session):
        super().__init__(Designation, db)

    def list_by_department(self, department_id: int) -> List[Designation]:
        return (
            self.db.query(Designation)
            .filter(Designation.department_id == department_id)
            .all()
        )


class ShiftRepository(BaseRepository[Shift]):
    def __init__(self, db: Session):
        super().__init__(Shift, db)

    def list_by_company(self, company_id: int) -> List[Shift]:
        return (
            self.db.query(Shift)
            .filter(Shift.company_id == company_id)
            .all()
        )


class AttendanceRulesRepository(BaseRepository[AttendanceRules]):
    def __init__(self, db: Session):
        super().__init__(AttendanceRules, db)

    def get_by_company(self, company_id: int) -> Optional[AttendanceRules]:
        return (
            self.db.query(AttendanceRules)
            .filter(AttendanceRules.company_id == company_id)
            .first()
        )
