"""Companies router — /api/v1/companies (Company, Dept, Designation, Shift)"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.models.user import User
from app.services.company_service import CompanyService
from app.schemas.company import (
    CompanyCreate, CompanyUpdate, CompanyResponse,
    DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    DesignationCreate, DesignationUpdate, DesignationResponse,
    ShiftCreate, ShiftUpdate, ShiftResponse,
)
from app.schemas.common import APIResponse, PaginatedResponse

router = APIRouter(tags=["Company Configuration"])


# ---- Company ----

@router.post("/companies", response_model=APIResponse[CompanyResponse], summary="Create company")
def create_company(payload: CompanyCreate, current_user: User = Depends(require_permission("manage", "company")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).create_company(payload, current_user.id))


@router.get("/companies", response_model=APIResponse[List[CompanyResponse]], summary="List active companies")
def list_companies(current_user: User = Depends(require_permission("manage", "company")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).list_companies())


@router.get("/companies/{company_id}", response_model=APIResponse[CompanyResponse], summary="Get company")
def get_company(company_id: int, current_user: User = Depends(require_permission("manage", "company")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).get_company(company_id))


@router.put("/companies/{company_id}", response_model=APIResponse[CompanyResponse], summary="Update company")
def update_company(company_id: int, payload: CompanyUpdate, current_user: User = Depends(require_permission("manage", "company")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).update_company(company_id, payload, current_user.id))


# ---- Department ----

@router.post("/departments", response_model=APIResponse[DepartmentResponse], summary="Create department")
def create_department(payload: DepartmentCreate, current_user: User = Depends(require_permission("manage", "department")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).create_department(payload, current_user.id))


@router.get("/departments", response_model=PaginatedResponse[DepartmentResponse], summary="List departments")
def list_departments(company_id: int, page: int = 1, page_size: int = 50, current_user: User = Depends(require_permission("view", "employee")), db: Session = Depends(get_db)):
    return CompanyService(db).list_departments(company_id, page, page_size)


@router.put("/departments/{dept_id}", response_model=APIResponse[DepartmentResponse], summary="Update department")
def update_department(dept_id: int, payload: DepartmentUpdate, current_user: User = Depends(require_permission("manage", "department")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).update_department(dept_id, payload, current_user.id))


@router.delete("/departments/{dept_id}", response_model=APIResponse[None], summary="Deactivate department")
def delete_department(dept_id: int, current_user: User = Depends(require_permission("manage", "department")), db: Session = Depends(get_db)):
    CompanyService(db).delete_department(dept_id, current_user.id)
    return APIResponse(message="Department deactivated")


# ---- Designation ----

@router.post("/designations", response_model=APIResponse[DesignationResponse], summary="Create designation")
def create_designation(payload: DesignationCreate, current_user: User = Depends(require_permission("manage", "designation")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).create_designation(payload, current_user.id))


@router.get("/designations", response_model=APIResponse[List[DesignationResponse]], summary="List designations by department")
def list_designations(department_id: int, current_user: User = Depends(require_permission("view", "employee")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).list_designations(department_id))


@router.put("/designations/{desig_id}", response_model=APIResponse[DesignationResponse], summary="Update designation")
def update_designation(desig_id: int, payload: DesignationUpdate, current_user: User = Depends(require_permission("manage", "designation")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).update_designation(desig_id, payload, current_user.id))


@router.delete("/designations/{desig_id}", response_model=APIResponse[None], summary="Deactivate designation")
def delete_designation(desig_id: int, current_user: User = Depends(require_permission("manage", "designation")), db: Session = Depends(get_db)):
    CompanyService(db).delete_designation(desig_id, current_user.id)
    return APIResponse(message="Designation deactivated")


# ---- Shift ----

@router.post("/shifts", response_model=APIResponse[ShiftResponse], summary="Create shift")
def create_shift(payload: ShiftCreate, current_user: User = Depends(require_permission("manage", "shift")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).create_shift(payload, current_user.id))


@router.get("/shifts", response_model=APIResponse[List[ShiftResponse]], summary="List shifts by company")
def list_shifts(company_id: int, current_user: User = Depends(require_permission("view", "employee")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).list_shifts(company_id))


@router.put("/shifts/{shift_id}", response_model=APIResponse[ShiftResponse], summary="Update shift")
def update_shift(shift_id: int, payload: ShiftUpdate, current_user: User = Depends(require_permission("manage", "shift")), db: Session = Depends(get_db)):
    return APIResponse(data=CompanyService(db).update_shift(shift_id, payload, current_user.id))


@router.delete("/shifts/{shift_id}", response_model=APIResponse[None], summary="Deactivate shift")
def delete_shift(shift_id: int, current_user: User = Depends(require_permission("manage", "shift")), db: Session = Depends(get_db)):
    CompanyService(db).delete_shift(shift_id, current_user.id)
    return APIResponse(message="Shift deactivated")
