"""
Models package — import all models here so Alembic's autogenerate
can see every table when it scans Base.metadata.
"""
from app.models.company import Company, Department, Designation, Shift, AttendanceRules
from app.models.user import User, Role, Permission, RefreshToken, role_permissions
from app.models.employee import Employee
from app.models.attendance import Attendance, AttendanceDeviceLog
from app.models.leave import LeaveType, LeaveBalance, Leave, Holiday, CompOff
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.settings import Settings

__all__ = [
    "Company", "Department", "Designation", "Shift", "AttendanceRules",
    "User", "Role", "Permission", "RefreshToken", "role_permissions",
    "Employee",
    "Attendance", "AttendanceDeviceLog",
    "LeaveType", "LeaveBalance", "Leave", "Holiday", "CompOff",
    "AuditLog",
    "Notification",
    "Settings",
]
