"""
Company service — Company, Department, Designation, Shift, Holiday, LeaveType CRUD.
"""
from __future__ import annotations
import math
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company import Company, Department, Designation, Shift
from app.models.leave import LeaveType, Holiday
from app.repository.company_repo import (
    CompanyRepository, DepartmentRepository,
    DesignationRepository, ShiftRepository,
)
from app.repository.audit_repo import AuditRepository
from app.repository.base import BaseRepository
from app.schemas.company import (
    CompanyCreate, CompanyUpdate, CompanyResponse,
    DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    DesignationCreate, DesignationUpdate, DesignationResponse,
    ShiftCreate, ShiftUpdate, ShiftResponse,
)
from app.schemas.leave import (
    LeaveTypeCreate, LeaveTypeUpdate, LeaveTypeResponse,
    HolidayCreate, HolidayUpdate, HolidayResponse,
)
from app.schemas.common import PaginatedResponse


class CompanyService:
    def __init__(self, db: Session):
        self.db = db
        self.company_repo = CompanyRepository(db)
        self.dept_repo = DepartmentRepository(db)
        self.desig_repo = DesignationRepository(db)
        self.shift_repo = ShiftRepository(db)
        self.audit_repo = AuditRepository(db)
        # Generic repos for LeaveType and Holiday
        self.leave_type_repo = BaseRepository(LeaveType, db)
        self.holiday_repo = BaseRepository(Holiday, db)

    # ------------------------------------------------------------------
    # Company
    # ------------------------------------------------------------------

    def create_company(self, payload: CompanyCreate, actor_id: int) -> CompanyResponse:
        company = Company(**payload.model_dump())
        self.company_repo.create(company)
        self.audit_repo.log(
            user_id=actor_id, action="company_created",
            entity_type="Company", entity_id=company.id,
            after_data={"name": company.name},
        )
        self.db.commit()
        self.db.refresh(company)
        return CompanyResponse.model_validate(company)

    def update_company(self, company_id: int, payload: CompanyUpdate, actor_id: int) -> CompanyResponse:
        company = self._get_or_404(self.company_repo, company_id, "Company")
        for field, val in payload.model_dump(exclude_unset=True).items():
            setattr(company, field, val)
        self.audit_repo.log(user_id=actor_id, action="company_updated",
                            entity_type="Company", entity_id=company_id)
        self.db.commit()
        self.db.refresh(company)
        return CompanyResponse.model_validate(company)

    def get_company(self, company_id: int) -> CompanyResponse:
        company = self._get_or_404(self.company_repo, company_id, "Company")
        return CompanyResponse.model_validate(company)

    def list_companies(self) -> List[CompanyResponse]:
        return [CompanyResponse.model_validate(c) for c in self.company_repo.get_active()]

    # ------------------------------------------------------------------
    # Department
    # ------------------------------------------------------------------

    def create_department(self, payload: DepartmentCreate, actor_id: int) -> DepartmentResponse:
        existing = self.dept_repo.get_by_name(payload.company_id, payload.name)
        if existing:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                detail=f"Department '{payload.name}' already exists")
        dept = Department(**payload.model_dump())
        self.dept_repo.create(dept)
        self.audit_repo.log(user_id=actor_id, action="department_created",
                            entity_type="Department", entity_id=dept.id)
        self.db.commit()
        self.db.refresh(dept)
        return DepartmentResponse.model_validate(dept)

    def update_department(self, dept_id: int, payload: DepartmentUpdate, actor_id: int) -> DepartmentResponse:
        dept = self._get_or_404(self.dept_repo, dept_id, "Department")
        for field, val in payload.model_dump(exclude_unset=True).items():
            setattr(dept, field, val)
        self.audit_repo.log(user_id=actor_id, action="department_updated",
                            entity_type="Department", entity_id=dept_id)
        self.db.commit()
        self.db.refresh(dept)
        return DepartmentResponse.model_validate(dept)

    def list_departments(self, company_id: int, page: int = 1, page_size: int = 50) -> PaginatedResponse[DepartmentResponse]:
        items, total = self.dept_repo.list_by_company(company_id, (page-1)*page_size, page_size)
        return PaginatedResponse(
            data=[DepartmentResponse.model_validate(d) for d in items],
            total=total, page=page, page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 0,
        )

    def delete_department(self, dept_id: int, actor_id: int) -> None:
        dept = self._get_or_404(self.dept_repo, dept_id, "Department")
        dept.is_active = False
        self.audit_repo.log(user_id=actor_id, action="department_deactivated",
                            entity_type="Department", entity_id=dept_id)
        self.db.commit()

    # ------------------------------------------------------------------
    # Designation
    # ------------------------------------------------------------------

    def create_designation(self, payload: DesignationCreate, actor_id: int) -> DesignationResponse:
        desig = Designation(**payload.model_dump())
        self.desig_repo.create(desig)
        self.audit_repo.log(user_id=actor_id, action="designation_created",
                            entity_type="Designation", entity_id=desig.id)
        self.db.commit()
        self.db.refresh(desig)
        return DesignationResponse.model_validate(desig)

    def update_designation(self, desig_id: int, payload: DesignationUpdate, actor_id: int) -> DesignationResponse:
        desig = self._get_or_404(self.desig_repo, desig_id, "Designation")
        for field, val in payload.model_dump(exclude_unset=True).items():
            setattr(desig, field, val)
        self.db.commit()
        self.db.refresh(desig)
        return DesignationResponse.model_validate(desig)

    def list_designations(self, department_id: int) -> List[DesignationResponse]:
        items = self.desig_repo.list_by_department(department_id)
        return [DesignationResponse.model_validate(d) for d in items]

    def delete_designation(self, desig_id: int, actor_id: int) -> None:
        desig = self._get_or_404(self.desig_repo, desig_id, "Designation")
        desig.is_active = False
        self.db.commit()

    # ------------------------------------------------------------------
    # Shift
    # ------------------------------------------------------------------

    def create_shift(self, payload: ShiftCreate, actor_id: int) -> ShiftResponse:
        shift = Shift(**payload.model_dump())
        self.shift_repo.create(shift)
        self.audit_repo.log(user_id=actor_id, action="shift_created",
                            entity_type="Shift", entity_id=shift.id)
        self.db.commit()
        self.db.refresh(shift)
        return ShiftResponse.model_validate(shift)

    def update_shift(self, shift_id: int, payload: ShiftUpdate, actor_id: int) -> ShiftResponse:
        shift = self._get_or_404(self.shift_repo, shift_id, "Shift")
        for field, val in payload.model_dump(exclude_unset=True).items():
            setattr(shift, field, val)
        self.db.commit()
        self.db.refresh(shift)
        return ShiftResponse.model_validate(shift)

    def list_shifts(self, company_id: int) -> List[ShiftResponse]:
        return [ShiftResponse.model_validate(s) for s in self.shift_repo.list_by_company(company_id)]

    def delete_shift(self, shift_id: int, actor_id: int) -> None:
        shift = self._get_or_404(self.shift_repo, shift_id, "Shift")
        shift.is_active = False
        self.db.commit()

    # ------------------------------------------------------------------
    # Holiday
    # ------------------------------------------------------------------

    def create_holiday(self, payload: HolidayCreate, actor_id: int) -> HolidayResponse:
        holiday = Holiday(**payload.model_dump())
        self.holiday_repo.create(holiday)
        self.audit_repo.log(user_id=actor_id, action="holiday_created",
                            entity_type="Holiday", entity_id=holiday.id)
        self.db.commit()
        self.db.refresh(holiday)
        return HolidayResponse.model_validate(holiday)

    def update_holiday(self, holiday_id: int, payload: HolidayUpdate, actor_id: int) -> HolidayResponse:
        holiday = self._get_or_404(self.holiday_repo, holiday_id, "Holiday")
        for field, val in payload.model_dump(exclude_unset=True).items():
            setattr(holiday, field, val)
        self.db.commit()
        self.db.refresh(holiday)
        return HolidayResponse.model_validate(holiday)

    def list_holidays(self, company_id: int) -> List[HolidayResponse]:
        items = (
            self.db.query(Holiday)
            .filter(Holiday.company_id == company_id)
            .order_by(Holiday.date)
            .all()
        )
        return [HolidayResponse.model_validate(h) for h in items]

    def delete_holiday(self, holiday_id: int, actor_id: int) -> None:
        holiday = self._get_or_404(self.holiday_repo, holiday_id, "Holiday")
        self.holiday_repo.delete(holiday)
        self.db.commit()

    # ------------------------------------------------------------------
    # Leave Type
    # ------------------------------------------------------------------

    def create_leave_type(self, payload: LeaveTypeCreate, actor_id: int) -> LeaveTypeResponse:
        lt = LeaveType(**payload.model_dump())
        self.leave_type_repo.create(lt)
        self.audit_repo.log(user_id=actor_id, action="leave_type_created",
                            entity_type="LeaveType", entity_id=lt.id)
        self.db.commit()
        self.db.refresh(lt)
        return LeaveTypeResponse.model_validate(lt)

    def update_leave_type(self, lt_id: int, payload: LeaveTypeUpdate, actor_id: int) -> LeaveTypeResponse:
        lt = self._get_or_404(self.leave_type_repo, lt_id, "LeaveType")
        for field, val in payload.model_dump(exclude_unset=True).items():
            setattr(lt, field, val)
        self.db.commit()
        self.db.refresh(lt)
        return LeaveTypeResponse.model_validate(lt)

    def list_leave_types(self, company_id: int) -> List[LeaveTypeResponse]:
        items = (
            self.db.query(LeaveType)
            .filter(LeaveType.company_id == company_id, LeaveType.is_active == True)  # noqa
            .all()
        )
        return [LeaveTypeResponse.model_validate(lt) for lt in items]

    def delete_leave_type(self, lt_id: int, actor_id: int) -> None:
        lt = self._get_or_404(self.leave_type_repo, lt_id, "LeaveType")
        lt.is_active = False
        self.db.commit()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _get_or_404(self, repo, entity_id: int, entity_name: str):
        obj = repo.get(entity_id)
        if not obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{entity_name} not found",
            )
        return obj
