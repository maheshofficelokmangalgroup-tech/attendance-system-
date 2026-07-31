"""
Seed script — run once on a fresh DB to populate:
  - Roles + Permissions (from RBAC matrix)
  - Sample Company + Department + Designation + Shift
  - Admin user account
  - Default AttendanceRules
  - Default Leave Types (PL, SL, CL, CompOff, LWP)

Usage:
    cd backend/
    python scripts/seed.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import date, datetime, time, timedelta
from app.core.database import SessionLocal, engine
from app.core.database import Base
from app.core.config import settings
from app.core.security import hash_password
import app.models  # noqa — ensure all models registered with Base.metadata

from app.models.user import Role, Permission, User
from app.models.company import Company, Department, Designation, Shift, AttendanceRules
from app.models.employee import Employee, EmploymentTypeEnum
from app.models.leave import LeaveType, AccrualTypeEnum, Leave, LeaveBalance, LeaveStatusEnum, LeaveApprovalStatusEnum
from app.models.attendance import Attendance, AttendanceStatusEnum
from app.auth.rbac import PERMISSION_MATRIX


def seed():
    print("Creating tables (if not exist)...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # ------------------------------------------------------------------
        # Roles
        # ------------------------------------------------------------------
        role_defs = [
            ("Admin", "admin", "Full system access"),
            ("HR", "hr", "HR and policy management"),
            ("Manager", "manager", "Team management"),
            ("Employee", "employee", "Self-service"),
        ]
        roles = {}
        for name, slug, desc in role_defs:
            role = db.query(Role).filter_by(slug=slug).first()
            if not role:
                role = Role(name=name, slug=slug, description=desc)
                db.add(role)
                db.flush()
                print(f"  Created role: {name}")
            roles[slug] = role

        # ------------------------------------------------------------------
        # Permissions (from RBAC matrix)
        # ------------------------------------------------------------------
        perm_cache = {}
        for (action, resource), allowed_roles in PERMISSION_MATRIX.items():
            perm = db.query(Permission).filter_by(action=action, resource=resource).first()
            if not perm:
                perm = Permission(action=action, resource=resource)
                db.add(perm)
                db.flush()
            perm_cache[(action, resource)] = perm

            # Assign permission to each allowed role
            for role_slug in allowed_roles:
                role = roles[role_slug]
                if perm not in role.permissions:
                    role.permissions.append(perm)

        print(f"  Seeded {len(perm_cache)} permissions")

        # ------------------------------------------------------------------
        # Company
        # ------------------------------------------------------------------
        company = db.query(Company).filter_by(name="Acme Corp").first()
        if not company:
            company = Company(
                name="Acme Corp",
                address="123 Business Park, Mumbai, India",
                phone="+91-22-12345678",
                email="hr@acmecorp.com",
                # Office geofence is left unset (disabled) by default — real employees
                # check in from real, varying locations, so a demo/seed coordinate would
                # just reject every check-in that isn't near it. To enforce a real office
                # location, set office_latitude/office_longitude/geofence_radius_meters
                # (meters) to your actual office's coordinates.
                office_latitude=None,
                office_longitude=None,
                geofence_radius_meters=None,
            )
            db.add(company)
            db.flush()
            print(f"  Created company: {company.name}")

        # ------------------------------------------------------------------
        # AttendanceRules (default)
        # ------------------------------------------------------------------
        rules = db.query(AttendanceRules).filter_by(company_id=company.id).first()
        if not rules:
            rules = AttendanceRules(
                company_id=company.id,
                grace_period_minutes=15,
                half_day_hours=4.0,
                full_day_hours=8.0,
                overtime_threshold_minutes=30,
                comp_off_threshold_minutes=240,
                allow_wfh=True,
                allow_on_duty=True,
            )
            db.add(rules)
            db.flush()
            print("  Created default attendance rules")

        # ------------------------------------------------------------------
        # Departments
        # ------------------------------------------------------------------
        dept_names = ["Engineering", "Human Resources", "Sales", "Operations", "Finance", "IT", "Construction"]
        depts = {}
        for name in dept_names:
            dept = db.query(Department).filter_by(company_id=company.id, name=name).first()
            if not dept:
                dept = Department(company_id=company.id, name=name)
                db.add(dept)
                db.flush()
            depts[name] = dept
        print(f"  Seeded {len(depts)} departments")

        # ------------------------------------------------------------------
        # Designations
        # ------------------------------------------------------------------
        desig_map = {
            "Engineering": ["Software Engineer", "Senior Engineer", "Engineering Manager"],
            "Human Resources": ["HR Executive", "HR Manager"],
            "Sales": ["Sales Executive", "Sales Manager"],
            "Operations": ["Operations Executive", "Operations Manager"],
            "Finance": ["Finance Executive", "Finance Manager"],
            "IT": ["IT Support Executive", "System Administrator", "IT Manager"],
            "Construction": ["Site Engineer", "Site Supervisor", "Construction Manager"],
        }
        for dept_name, desig_names in desig_map.items():
            dept = depts[dept_name]
            for desig_name in desig_names:
                existing = db.query(Designation).filter_by(department_id=dept.id, name=desig_name).first()
                if not existing:
                    db.add(Designation(department_id=dept.id, name=desig_name))
        db.flush()
        print("  Seeded designations")

        # ------------------------------------------------------------------
        # Shifts
        # ------------------------------------------------------------------
        shift_defs = [
            # name, start, end, overtime_threshold_minutes
            ("Morning Shift", time(9, 0), time(18, 0), 30),
            ("Night Shift", time(21, 0), time(6, 0), 30),
            ("General Shift", time(10, 0), time(19, 0), 30),
            # IT team: officially 10-6, but routinely runs late; a wide overtime
            # threshold (2 hours) means finishing as late as ~8pm isn't flagged.
            ("IT Shift", time(10, 0), time(18, 0), 120),
        ]
        shifts = {}
        for name, start, end, overtime_threshold in shift_defs:
            shift = db.query(Shift).filter_by(company_id=company.id, name=name).first()
            if not shift:
                shift = Shift(
                    company_id=company.id,
                    name=name,
                    start_time=start,
                    end_time=end,
                    grace_period_minutes=15,
                    half_day_hours=4.0,
                    working_hours=8.0,
                    overtime_threshold_minutes=overtime_threshold,
                )
                db.add(shift)
                db.flush()
            shifts[name] = shift
        print("  Seeded shifts")

        # ------------------------------------------------------------------
        # Leave Types
        # ------------------------------------------------------------------
        leave_type_defs = [
            ("Privilege Leave", "PL", 12, AccrualTypeEnum.MONTHLY, True, 10, True),
            ("Sick Leave", "SL", 6, AccrualTypeEnum.UPFRONT, False, 0, True),
            ("Casual Leave", "CL", 6, AccrualTypeEnum.UPFRONT, False, 0, True),
            ("Compensatory Off", "COMP", 0, AccrualTypeEnum.UPFRONT, False, 0, False),
            ("Leave Without Pay", "LWP", 0, AccrualTypeEnum.UPFRONT, False, 0, False),
        ]
        leave_types = {}
        for name, code, days, accrual, carry, max_carry, is_paid in leave_type_defs:
            lt = db.query(LeaveType).filter_by(company_id=company.id, code=code).first()
            if not lt:
                lt = LeaveType(
                    company_id=company.id,
                    name=name,
                    code=code,
                    days_per_year=days,
                    accrual_type=accrual,
                    carry_forward=carry,
                    max_carry_forward_days=max_carry,
                    is_paid=is_paid,
                )
                db.add(lt)
                db.flush()
            leave_types[code] = lt
        print("  Seeded leave types")

        # ------------------------------------------------------------------
        # Sample Employees — kept to exactly 2 real-world teams (IT and
        # Construction), so there's real data to log in as without a pile of
        # unused demo personas. Admin (below) covers HR/Manager-level actions
        # for now (approvals, reports) until dedicated HR/Manager hires exist.
        # ------------------------------------------------------------------
        it_dept = depts["IT"]
        it_support_desig = db.query(Designation).filter_by(department_id=it_dept.id, name="IT Support Executive").first()
        construction_dept = depts["Construction"]
        site_engineer_desig = db.query(Designation).filter_by(department_id=construction_dept.id, name="Site Engineer").first()
        morning_shift = shifts["Morning Shift"]
        it_shift = shifts["IT Shift"]

        def get_or_create_employee(code, first, last, email, dept, desig, shift, manager=None):
            emp = db.query(Employee).filter_by(employee_code=code).first()
            if not emp:
                emp = Employee(
                    company_id=company.id,
                    department_id=dept.id,
                    designation_id=desig.id if desig else None,
                    shift_id=shift.id if shift else None,
                    manager_id=manager.id if manager else None,
                    employee_code=code,
                    first_name=first,
                    last_name=last,
                    email=email,
                    date_of_joining=date(2024, 1, 15),
                    employment_type=EmploymentTypeEnum.FULL_TIME,
                )
                db.add(emp)
                db.flush()
            return emp

        def get_or_create_user_for(emp, role_slug, password):
            user = db.query(User).filter_by(employee_id=emp.id).first()
            if not user:
                user = User(
                    email=emp.email,
                    password_hash=hash_password(password),
                    role_id=roles[role_slug].id,
                    employee_id=emp.id,
                    is_active=True,
                )
                db.add(user)
                db.flush()
            return user

        it_person = get_or_create_employee("EMP-IT-001", "Aditya", "Joshi", "aditya.joshi@acmecorp.com", it_dept, it_support_desig, it_shift)
        get_or_create_user_for(it_person, "employee", "Employee@123")

        construction_person = get_or_create_employee("EMP-CON-001", "Ganesh", "Patil", "ganesh.patil@acmecorp.com", construction_dept, site_engineer_desig, morning_shift)
        get_or_create_user_for(construction_person, "employee", "Employee@123")

        team = [it_person, construction_person]
        print(f"  Seeded {len(team)} sample employees (IT & Construction) with login accounts")

        # ------------------------------------------------------------------
        # Sample leave balances (current year, for every active leave type)
        # ------------------------------------------------------------------
        year = date.today().year
        for emp in team:
            for code, lt in leave_types.items():
                bal = db.query(LeaveBalance).filter_by(employee_id=emp.id, leave_type_id=lt.id, year=year).first()
                if not bal:
                    db.add(LeaveBalance(
                        employee_id=emp.id, leave_type_id=lt.id, year=year,
                        total_days=float(lt.days_per_year), used_days=0.0, balance_days=float(lt.days_per_year),
                    ))
        db.flush()
        print("  Seeded leave balances for all sample employees")

        # ------------------------------------------------------------------
        # Sample attendance — last 5 working days for the team, so the
        # dashboard/reports/muster-roll have real rows to render.
        # ------------------------------------------------------------------
        today = date.today()
        sample_days = [today - timedelta(days=d) for d in range(1, 6) if (today - timedelta(days=d)).weekday() < 5]
        for emp in team:
            for i, day in enumerate(sample_days):
                existing_att = db.query(Attendance).filter_by(employee_id=emp.id, date=day).first()
                if existing_att:
                    continue
                is_late = (i == 0)  # first sampled day: late, rest: present
                db.add(Attendance(
                    employee_id=emp.id,
                    date=day,
                    check_in_time=time(9, 20) if is_late else time(8, 55),
                    check_in_latitude=19.0760, check_in_longitude=72.8777, check_in_gps_accuracy=12.0,
                    check_out_time=time(18, 10),
                    check_out_latitude=19.0760, check_out_longitude=72.8777, check_out_gps_accuracy=10.0,
                    working_hours=8.83,
                    status=AttendanceStatusEnum.LATE if is_late else AttendanceStatusEnum.PRESENT,
                ))
        db.flush()
        print("  Seeded sample attendance history for the team")

        # ------------------------------------------------------------------
        # Sample leave request — no manager is seeded currently, so this goes
        # straight to the Admin/HR approval queue (first_approver_id=None),
        # so the queue and Team Calendar have something real to show.
        # ------------------------------------------------------------------
        existing_leave = db.query(Leave).filter_by(employee_id=team[0].id).first()
        if not existing_leave and team:
            applicant = team[0]
            leave_from = today + timedelta(days=7)
            leave_to = leave_from + timedelta(days=1)
            db.add(Leave(
                employee_id=applicant.id,
                leave_type_id=leave_types["CL"].id,
                from_date=leave_from,
                to_date=leave_to,
                total_days=2,
                reason="Family function",
                status=LeaveStatusEnum.PENDING,
                applied_by=applicant.id,
                first_approver_id=None,
                first_approval_status=LeaveApprovalStatusEnum.PENDING,
                final_approval_status=LeaveApprovalStatusEnum.PENDING,
            ))
            db.flush()
            print("  Seeded 1 sample pending leave request (awaiting Admin/HR approval)")

        # ------------------------------------------------------------------
        # Admin user
        # ------------------------------------------------------------------
        admin_role = roles["admin"]
        admin_user = db.query(User).filter_by(email=settings.ADMIN_EMAIL).first()
        if not admin_user:
            admin_user = User(
                email=settings.ADMIN_EMAIL,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                role_id=admin_role.id,
                is_active=True,
            )
            db.add(admin_user)
            db.flush()
            print(f"  Created admin user: {settings.ADMIN_EMAIL}")
        else:
            print(f"  Admin user already exists: {settings.ADMIN_EMAIL}")

        db.commit()
        print("\nSeed complete!")
        print(f"   Admin login: {settings.ADMIN_EMAIL} / {settings.ADMIN_PASSWORD}")
        print("   IT employee login: aditya.joshi@acmecorp.com / Employee@123")
        print("   Construction employee login: ganesh.patil@acmecorp.com / Employee@123")

    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
