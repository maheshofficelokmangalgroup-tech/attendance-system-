"""Attendance repository."""
from __future__ import annotations
from datetime import date, datetime
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_

from app.models.attendance import Attendance, AttendanceDeviceLog, AttendanceStatusEnum
from app.models.employee import Employee
from app.repository.base import BaseRepository


class AttendanceRepository(BaseRepository[Attendance]):
    def __init__(self, db: Session):
        super().__init__(Attendance, db)

    def get_by_employee_and_date(self, employee_id: int, target_date: date) -> Optional[Attendance]:
        return (
            self.db.query(Attendance)
            .options(joinedload(Attendance.device_logs), joinedload(Attendance.employee))
            .filter(
                Attendance.employee_id == employee_id,
                Attendance.date == target_date,
            )
            .first()
        )

    def get_with_logs(self, attendance_id: int) -> Optional[Attendance]:
        return (
            self.db.query(Attendance)
            .options(joinedload(Attendance.device_logs), joinedload(Attendance.employee))
            .filter(Attendance.id == attendance_id)
            .first()
        )

    def list_paginated(
        self,
        company_id: int,
        skip: int = 0,
        limit: int = 20,
        employee_id: Optional[int] = None,
        department_id: Optional[int] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        status: Optional[AttendanceStatusEnum] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Attendance], int]:
        q = (
            self.db.query(Attendance)
            .join(Employee, Attendance.employee_id == Employee.id)
            .options(
                joinedload(Attendance.employee).joinedload(Employee.department),
                joinedload(Attendance.device_logs),
            )
            .filter(Employee.company_id == company_id)
        )

        if employee_id is not None:
            q = q.filter(Attendance.employee_id == employee_id)
        if department_id is not None:
            q = q.filter(Employee.department_id == department_id)
        if from_date is not None:
            q = q.filter(Attendance.date >= from_date)
        if to_date is not None:
            q = q.filter(Attendance.date <= to_date)
        if status is not None:
            q = q.filter(Attendance.status == status)
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
        items = q.order_by(Attendance.date.desc(), Attendance.id.desc()).offset(skip).limit(limit).all()
        return items, total

    def get_today_summary(self, company_id: int, target_date: date) -> Dict[str, int]:
        """Calculates attendance summary breakdown for a specific company and date."""
        total_employees = (
            self.db.query(Employee)
            .filter(Employee.company_id == company_id, Employee.is_active == True)  # noqa
            .count()
        )

        counts = (
            self.db.query(Attendance.status, func.count(Attendance.id))
            .join(Employee, Attendance.employee_id == Employee.id)
            .filter(
                Employee.company_id == company_id,
                Attendance.date == target_date,
            )
            .group_by(Attendance.status)
            .all()
        )

        status_map = {status: count for status, count in counts}

        present_count = status_map.get(AttendanceStatusEnum.PRESENT, 0)
        late_count = status_map.get(AttendanceStatusEnum.LATE, 0)
        wfh_count = status_map.get(AttendanceStatusEnum.WFH, 0)
        on_duty_count = status_map.get(AttendanceStatusEnum.ON_DUTY, 0)
        on_leave_count = status_map.get(AttendanceStatusEnum.ON_LEAVE, 0)
        half_day_count = status_map.get(AttendanceStatusEnum.HALF_DAY, 0)

        # Count total recorded today
        recorded_total = sum(status_map.values())
        absent_today = status_map.get(AttendanceStatusEnum.ABSENT, 0) + max(0, total_employees - recorded_total)

        return {
            "total_employees": total_employees,
            "present_today": present_count + late_count + half_day_count,
            "absent_today": absent_today,
            "late_today": late_count,
            "on_leave_today": on_leave_count,
            "wfh_today": wfh_count,
            "on_duty_today": on_duty_count,
        }

    def add_device_log(self, device_log: AttendanceDeviceLog) -> AttendanceDeviceLog:
        self.db.add(device_log)
        self.db.flush()
        return device_log
