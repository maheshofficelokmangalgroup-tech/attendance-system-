"""
Employee service — CRUD, role assignment, search, pagination.
"""
from __future__ import annotations
from typing import List, Optional, Tuple
import math

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.employee import Employee, EmployeeKyc, EmployeeAsset
from app.models.leave import Leave
from app.models.user import User
from app.models.company import Company, Department, Designation, Shift
from app.repository.employee_repo import EmployeeRepository
from app.repository.user_repo import UserRepository, RefreshTokenRepository
from app.repository.audit_repo import AuditRepository
from app.services.storage_service import get_storage_service
from app.utils.image import validate_image_upload, validate_document_upload, generate_unique_filename
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse, EmployeeListItem,
    EmployeeKycUpsert, EmployeeKycResponse,
    EmployeeAssetCreate, EmployeeAssetUpdate, EmployeeAssetResponse,
)
from app.schemas.common import PaginatedResponse


class EmployeeService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = EmployeeRepository(db)
        self.user_repo = UserRepository(db)
        self.token_repo = RefreshTokenRepository(db)
        self.audit_repo = AuditRepository(db)

    def _validate_refs(self, department_id=None, designation_id=None, shift_id=None, company_id=None) -> None:
        """Reject nonexistent company/department/designation/shift ids with a
        clean 400 instead of letting them hit the DB as a foreign-key
        IntegrityError — a bad value here used to 500 and roll back the
        *entire* update, silently discarding every other field change in
        the same request."""
        if company_id is not None and not self.db.get(Company, company_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Company ID {company_id} not found")
        if department_id is not None and not self.db.get(Department, department_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Department ID {department_id} not found")
        if designation_id is not None and not self.db.get(Designation, designation_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Designation ID {designation_id} not found")
        if shift_id is not None and not self.db.get(Shift, shift_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Shift ID {shift_id} not found")

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
        self._validate_refs(payload.department_id, payload.designation_id, payload.shift_id)

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
            permanent_address=payload.permanent_address,
            present_address=payload.present_address,
            emergency_contact_name=payload.emergency_contact_name,
            emergency_contact_phone=payload.emergency_contact_phone,
            emergency_contact_relation=payload.emergency_contact_relation,
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

        before = {"is_active": employee.is_active, "company_id": employee.company_id, "department_id": employee.department_id}
        update_data = payload.model_dump(exclude_unset=True)
        self._validate_refs(
            update_data.get("department_id"),
            update_data.get("designation_id"),
            update_data.get("shift_id"),
            update_data.get("company_id"),
        )

        # Handle role update separately (it's on the User model, not Employee)
        role_id = update_data.pop("role_id", None)
        if role_id is not None:
            if not self.user_repo.get_role_by_id(role_id):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role ID {role_id} not found")
            if employee.user:
                employee.user.role_id = role_id

        for field, value in update_data.items():
            setattr(employee, field, value)

        after = {"is_active": employee.is_active, "company_id": employee.company_id, "department_id": employee.department_id}
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

    def hard_delete(self, employee_id: int, actor_id: int, ip: Optional[str] = None) -> None:
        """
        Permanently and irreversibly removes an employee and everything
        directly owned by them (attendance, leaves, balances, KYC, assets,
        device logs, notifications, comp-offs, the linked login account) —
        unlike delete() (soft deactivate), this makes them disappear from
        every list and report entirely. For purging test/demo data, never
        for a real employee's record.

        Deletes via a direct bulk query (not session.delete()) so the
        database's own ON DELETE CASCADE/SET NULL constraints do the
        cascading — session.delete() instead tries to null out child FKs at
        the ORM level first, which fails on the ones that are NOT NULL.
        """
        from app.models.user import User

        employee = self.repo.get(employee_id)
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

        before = {
            "employee_code": employee.employee_code,
            "full_name": employee.full_name,
            "email": employee.email,
        }
        user = employee.user

        # Leave.applied_by is NOT NULL + ON DELETE RESTRICT (an HR/Admin
        # applying leave on someone else's behalf) — the only reference to
        # employees.id that isn't CASCADE/SET NULL. InnoDB checks it
        # independently per row, so it blocks the delete even for the
        # employee's *own* leaves (applied_by == employee_id there too) —
        # those rows are about to be cascade-deleted via employee_id anyway,
        # but the RESTRICT check still runs first, so every row referencing
        # this employee as applicant must be reassigned, not just others'.
        self.db.query(Leave).filter(
            Leave.applied_by == employee_id
        ).update({Leave.applied_by: actor_id}, synchronize_session=False)

        self.audit_repo.log(
            user_id=actor_id,
            action="employee_hard_deleted",
            entity_type="Employee",
            entity_id=employee_id,
            before_data=before,
            ip_address=ip,
        )

        self.db.query(Employee).filter(Employee.id == employee_id).delete(synchronize_session=False)
        if user:
            self.db.query(User).filter(User.id == user.id).delete(synchronize_session=False)
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

    def upload_photo(self, employee_id: int, photo: UploadFile) -> EmployeeResponse:
        employee = self.repo.get(employee_id)
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

        ext = validate_image_upload(photo)
        filename = generate_unique_filename(employee_id, "photo", ext)
        storage = get_storage_service()
        employee.photo_path = storage.save_file(photo.file, f"employees/{filename}")

        self.db.commit()
        self.db.refresh(employee)
        return self.get(employee_id)

    def get_kyc(self, employee_id: int) -> Optional[EmployeeKycResponse]:
        if not self.repo.get(employee_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        kyc = self.db.query(EmployeeKyc).filter_by(employee_id=employee_id).first()
        return EmployeeKycResponse.model_validate(kyc) if kyc else None

    def upsert_kyc(
        self, employee_id: int, payload: EmployeeKycUpsert, actor_id: int, ip: Optional[str] = None,
    ) -> EmployeeKycResponse:
        if not self.repo.get(employee_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

        kyc = self.db.query(EmployeeKyc).filter_by(employee_id=employee_id).first()
        data = payload.model_dump(exclude_unset=True)
        if not kyc:
            kyc = EmployeeKyc(employee_id=employee_id, **data)
            self.db.add(kyc)
        else:
            for field, value in data.items():
                setattr(kyc, field, value)

        self.audit_repo.log(
            user_id=actor_id,
            action="employee_kyc_updated",
            entity_type="Employee",
            entity_id=employee_id,
            ip_address=ip,
        )
        self.db.commit()
        self.db.refresh(kyc)
        return EmployeeKycResponse.model_validate(kyc)

    def upload_kyc_documents(
        self, employee_id: int,
        aadhar_front: Optional[UploadFile] = None,
        aadhar_back: Optional[UploadFile] = None,
        pan_photo: Optional[UploadFile] = None,
        degree_certificate: Optional[UploadFile] = None,
        actor_id: Optional[int] = None, ip: Optional[str] = None,
    ) -> EmployeeKycResponse:
        if not self.repo.get(employee_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

        kyc = self.db.query(EmployeeKyc).filter_by(employee_id=employee_id).first()
        if not kyc:
            kyc = EmployeeKyc(employee_id=employee_id)
            self.db.add(kyc)

        storage = get_storage_service()
        # Degree certificate is commonly a scanned PDF, not a photo — validated
        # against the looser document allow-list (images + PDF) instead.
        for upload, field, tag, validator in (
            (aadhar_front, "aadhar_front_path", "aadhar_front", validate_image_upload),
            (aadhar_back, "aadhar_back_path", "aadhar_back", validate_image_upload),
            (pan_photo, "pan_photo_path", "pan_photo", validate_image_upload),
            (degree_certificate, "degree_certificate_path", "degree_certificate", validate_document_upload),
        ):
            if upload is None:
                continue
            ext = validator(upload)
            filename = generate_unique_filename(employee_id, tag, ext)
            setattr(kyc, field, storage.save_file(upload.file, f"employees/kyc/{filename}"))

        self.audit_repo.log(
            user_id=actor_id,
            action="employee_kyc_documents_uploaded",
            entity_type="Employee",
            entity_id=employee_id,
            ip_address=ip,
        )
        self.db.commit()
        self.db.refresh(kyc)
        return EmployeeKycResponse.model_validate(kyc)

    def list_assets(self, employee_id: int) -> List[EmployeeAssetResponse]:
        if not self.repo.get(employee_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        assets = (
            self.db.query(EmployeeAsset)
            .filter_by(employee_id=employee_id)
            .order_by(EmployeeAsset.assigned_date.desc())
            .all()
        )
        return [EmployeeAssetResponse.model_validate(a) for a in assets]

    def add_asset(
        self, employee_id: int, payload: EmployeeAssetCreate, actor_id: int, ip: Optional[str] = None,
    ) -> EmployeeAssetResponse:
        if not self.repo.get(employee_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

        asset = EmployeeAsset(employee_id=employee_id, **payload.model_dump())
        self.db.add(asset)
        self.db.flush()
        self.audit_repo.log(
            user_id=actor_id,
            action="employee_asset_assigned",
            entity_type="EmployeeAsset",
            entity_id=asset.id,
            after_data={"asset_name": asset.asset_name, "employee_id": employee_id},
            ip_address=ip,
        )
        self.db.commit()
        self.db.refresh(asset)
        return EmployeeAssetResponse.model_validate(asset)

    def update_asset(
        self, employee_id: int, asset_id: int, payload: EmployeeAssetUpdate,
        actor_id: int, ip: Optional[str] = None,
    ) -> EmployeeAssetResponse:
        asset = self.db.query(EmployeeAsset).filter_by(id=asset_id, employee_id=employee_id).first()
        if not asset:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(asset, field, value)

        self.audit_repo.log(
            user_id=actor_id,
            action="employee_asset_updated",
            entity_type="EmployeeAsset",
            entity_id=asset.id,
            ip_address=ip,
        )
        self.db.commit()
        self.db.refresh(asset)
        return EmployeeAssetResponse.model_validate(asset)

    def delete_asset(self, employee_id: int, asset_id: int, actor_id: int, ip: Optional[str] = None) -> None:
        asset = self.db.query(EmployeeAsset).filter_by(id=asset_id, employee_id=employee_id).first()
        if not asset:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

        self.audit_repo.log(
            user_id=actor_id,
            action="employee_asset_removed",
            entity_type="EmployeeAsset",
            entity_id=asset.id,
            before_data={"asset_name": asset.asset_name},
            ip_address=ip,
        )
        self.db.delete(asset)
        self.db.commit()
