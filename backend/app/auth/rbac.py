"""
RBAC Permission Matrix — single source of truth.

Every endpoint guard calls `require_permission(action, resource)` which
checks this matrix. Never use `if role == "admin"` in route handlers.

Matrix encodes Section 6 of the project brief exactly.
"""
from typing import FrozenSet, Dict, Tuple

# Role slugs (must match seed data)
ROLE_ADMIN = "admin"
ROLE_HR = "hr"
ROLE_MANAGER = "manager"
ROLE_EMPLOYEE = "employee"

ALL_ROLES: Tuple[str, ...] = (ROLE_ADMIN, ROLE_HR, ROLE_MANAGER, ROLE_EMPLOYEE)

# ---------------------------------------------------------------------------
# Permission matrix
# Format: {(action, resource): frozenset_of_roles_that_can_do_it}
#
# For manager-scoped permissions (own team only), the service layer
# applies the additional scope check — RBAC determines *whether* a role
# can act, the service determines *what data* it can act on.
# ---------------------------------------------------------------------------

PERMISSION_MATRIX: Dict[Tuple[str, str], FrozenSet[str]] = {
    # Company / org structure setup
    ("manage", "company"):          frozenset([ROLE_ADMIN]),
    ("manage", "department"):       frozenset([ROLE_ADMIN]),
    ("manage", "designation"):      frozenset([ROLE_ADMIN]),
    ("manage", "shift"):            frozenset([ROLE_ADMIN]),

    # Policy configuration
    ("manage", "attendance_rules"): frozenset([ROLE_ADMIN, ROLE_HR]),
    ("manage", "leave_policy"):     frozenset([ROLE_ADMIN, ROLE_HR]),
    ("manage", "payroll_settings"): frozenset([ROLE_ADMIN, ROLE_HR]),
    ("manage", "system_settings"):  frozenset([ROLE_ADMIN]),

    # Holiday management
    ("manage", "holiday"):          frozenset([ROLE_ADMIN, ROLE_HR]),
    ("view",   "holiday"):          frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER, ROLE_EMPLOYEE]),

    # Leave type management
    ("manage", "leave_type"):       frozenset([ROLE_ADMIN, ROLE_HR]),
    ("view",   "leave_type"):       frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER, ROLE_EMPLOYEE]),

    # Employee CRUD
    ("create", "employee"):         frozenset([ROLE_ADMIN, ROLE_HR]),
    ("update", "employee"):         frozenset([ROLE_ADMIN, ROLE_HR]),
    ("delete", "employee"):         frozenset([ROLE_ADMIN]),
    ("view",   "employee"):         frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER, ROLE_EMPLOYEE]),

    # Employee KYC & bank details — sensitive PII, Admin/HR only (not Manager)
    ("view",   "employee_kyc"):     frozenset([ROLE_ADMIN, ROLE_HR]),
    ("update", "employee_kyc"):     frozenset([ROLE_ADMIN, ROLE_HR]),

    # Employee asset assignment
    ("view",   "employee_asset"):   frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER]),
    ("create", "employee_asset"):   frozenset([ROLE_ADMIN, ROLE_HR]),
    ("update", "employee_asset"):   frozenset([ROLE_ADMIN, ROLE_HR]),
    ("delete", "employee_asset"):   frozenset([ROLE_ADMIN, ROLE_HR]),

    # Attendance — view (manager: own team only, enforced in service)
    ("view",   "attendance"):       frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER, ROLE_EMPLOYEE]),
    ("manage", "attendance"):       frozenset([ROLE_ADMIN, ROLE_HR]),

    # Own attendance actions (everyone can check in/out)
    ("mark",   "own_attendance"):   frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER, ROLE_EMPLOYEE]),

    # Leave — apply own leave (everyone)
    ("apply",  "own_leave"):        frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER, ROLE_EMPLOYEE]),

    # Leave — view (manager: own team only)
    ("view",   "leave"):            frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER, ROLE_EMPLOYEE]),

    # Leave — first-level approval (Manager, HR, Admin)
    ("approve_first", "leave"):     frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER]),

    # Leave — final approval (HR, Admin only — not Manager)
    ("approve_final", "leave"):     frozenset([ROLE_ADMIN, ROLE_HR]),

    # Audit logs
    ("view",   "audit_log"):        frozenset([ROLE_ADMIN, ROLE_HR]),

    # Reports
    ("generate", "report_all"):     frozenset([ROLE_ADMIN, ROLE_HR]),
    ("generate", "report_team"):    frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER]),
    ("generate", "report_self"):    frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER, ROLE_EMPLOYEE]),
    ("view",     "report"):         frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER]),
    ("export",   "report"):         frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER]),

    # Role & permission management
    ("manage", "role"):             frozenset([ROLE_ADMIN]),

    # Notifications (everyone reads their own)
    ("view",   "notification"):     frozenset([ROLE_ADMIN, ROLE_HR, ROLE_MANAGER, ROLE_EMPLOYEE]),
}


def role_has_permission(role_slug: str, action: str, resource: str) -> bool:
    """Check if a role slug is allowed to perform action on resource."""
    allowed = PERMISSION_MATRIX.get((action, resource), frozenset())
    return role_slug in allowed
