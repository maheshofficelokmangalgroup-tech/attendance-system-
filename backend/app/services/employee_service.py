"""
Employee service — CRUD, role assignment, search, pagination.
"""
from __future__ import annotations
from typing import List, Optional, Tuple
import math

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.employee import Employee
from app.models.user import User
from app.repository.employee_repo import EmployeeRepository
from app.repository.user_repo import UserRepository, RefreshTokenRepository
from app.repository.audit_repo import AuditRepository
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse, EmployeeListItem
from app.schemas.common import PaginatedResponse


class EmployeeService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = EmployeeRepository(db)
        self.user_repo = UserRepository(db)
        self.token_repo = RefreshTokenRepository(db)
        self.audit_repo = AuditRepository(db)

    def create(
        self,
        payload: EmployeeCreate,
        actor_id: int,
        ip: Optional[str] = None,
    ) -> EmployeeResponse:
        # Guard: unique employee_code
        if self.repo.get_by_code(payload.employee_code):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Employee code '{payload.employee_code}' already exists",
            )
        # Guard: unique email
        if self.repo.get_by_email(payload.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{payload.email}' already in use",
            )
        # Guard: unique username
        if payload.username and self.user_repo.get_by_username_or_email(payload.username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Username '{payload.username}' already in use",
            )
        # Guard: role exists
        role = self.user_repo.get_role_by_id(payload.role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role ID {payload.role_id} not found",
            )

        employee = Employee(
            company_id=payload.company_id,
            department_id=payload.department_id,
            designation_id=payload.designation_id,
            shift_id=payload.shift_id,
            manager_id=payload.manager_id,
            employee_code=payload.employee_code,
            first_name=payload.first_name,
            last_name=payload.last_name,
            phone=payload.phone,
            email=payload.email.lower(),
            date_of_birth=payload.date_of_birth,
            date_of_joining=payload.date_of_joining,
            gender=payload.gender,
            address=payload.address,
            employment_type=payload.employment_type,
        )
        self.repo.create(employee)

        # Create linked user account. Admin may set an explicit initial password;
        # otherwise it defaults to the employee code — must change on first login.
        user = User(
            email=payload.email.lower(),
            username=payload.username,
            password_hash=hash_password(payload.password or payload.employee_code),
            role_id=payload.role_id,
            employee_id=employee.id,
        )
        self.user_repo.create(user)

        self.audit_repo.log(
            user_id=actor_id,
            action="employee_created",
            entity_type="Employee",
            entity_id=employee.id,
            after_data={"employee_code": employee.employee_code, "email": employee.email},
            ip_address=ip,
        )
        self.db.commit()
        self.db.refresh(employee)
        return EmployeeResponse.model_validate(employee)

    def update(
        self,
        employee_id: int,
        payload: EmployeeUpdate,
        actor_id: int,
        ip: Optional[str] = None,
    ) -> EmployeeResponse:
        employee = self.repo.get(employee_id)
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

        before = {"is_active": employee.is_active, "department_id": employee.department_id}
        update_data = payload.model_dump(exclude_unset=True)

        # Handle role update separately (it's on the User model, not Employee)
        role_id = update_data.pop("role_id", None)
        if role_id is not None and employee.user:
            employee.user.role_id = role_id

        for field, value in update_data.items():
            setattr(employee, field, value)

        after = {"is_active": employee.is_active, "department_id": employee.department_id}
        self.audit_repo.log(
            user_id=actor_id,
            action="employee_updated",
            entity_type="Employee",
            entity_id=employee.id,
            before_data=before,
            after_data=after,
            ip_address=ip,
        )
        self.db.commit()
        self.db.refresh(employee)
        return EmployeeResponse.model_validate(employee)

    def delete(self, employee_id: int, actor_id: int, ip: Optional[str] = None) -> None:
        employee = self.repo.get(employee_id)
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        # Soft-delete: deactivate rather than hard-delete to preserve history
        employee.is_active = False
        self.audit_repo.log(
            user_id=actor_id,
            action="employee_deactivated",
            entity_type="Employee",
            entity_id=employee.id,
            ip_address=ip,
        )
        self.db.commit()

    def get(self, employee_id: int) -> EmployeeResponse:
        employee = self.repo.get_with_details(employee_id)
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        data = EmployeeResponse.model_validate(employee)
        data.role_id = employee.user.role_id if employee.user else None
        return data

    def reset_password(
        self,
        employee_id: int,
        new_password: str,
        actor_id: int,
        ip: Optional[str] = None,
    ) -> None:
        employee = self.repo.get_with_details(employee_id)
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        if not employee.user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This employee has no login account")

        employee.user.password_hash = hash_password(new_password)
        # Force re-login everywhere so a stolen/old session can't outlive the reset
        self.token_repo.revoke_all_for_user(employee.user.id)

        self.audit_repo.log(
            user_id=actor_id,
            action="employee_password_reset",
            entity_type="Employee",
            entity_id=employee.id,
            ip_address=ip,
        )
        self.db.commit()

    def list(
        self,
        company_id: int,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        department_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> PaginatedResponse[EmployeeListItem]:
        skip = (page - 1) * page_size
        items, total = self.repo.list_paginated(
            company_id=company_id,
            skip=skip,
            limit=page_size,
            search=search,
            department_id=department_id,
            is_active=is_active,
        )
        return PaginatedResponse(
            data=[EmployeeListItem.model_validate(e) for e in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 0,
        )
