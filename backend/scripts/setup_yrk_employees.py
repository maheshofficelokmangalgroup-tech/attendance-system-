"""
One-off data setup for YRK Ventures ("HARMONY", Yoovie Homes, Pallod Farms,
Pune) — run once against the live DB to:

  1. Remove the leftover test employee (EMP-LEAVE-TEST / "Leave Tester")
     and everything tied to it (attendance, leaves, leave balances,
     notifications, refresh tokens, user account).
  2. Create the 19 real employees from the attendance sheet PDF, each with
     a username-style login (e.g. "Rohan@YRK") and password "123456".

Safe to re-run: every step is guarded by an existence check, so running it
twice does not duplicate data or error out.

Usage:
    cd backend/
    python scripts/setup_yrk_employees.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import date

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User, Role
from app.models.employee import Employee, EmploymentTypeEnum, GenderEnum
from app.models.company import Company, Department, Shift
from app.models.attendance import Attendance
from app.models.leave import Leave, LeaveBalance, CompOff
from app.models.notification import Notification

TEST_EMPLOYEE_CODE = "EMP-LEAVE-TEST"

# (employee_code, first_name, last_name, gender, username)
EMPLOYEES = [
    ("001", "Rohan", "Deshmukh", GenderEnum.MALE, "Rohan@YRK"),
    ("002", "Rajashree", "Kakde", GenderEnum.FEMALE, "Rajashree@YRK"),
    ("003", "Shubham", "Awasthi", GenderEnum.MALE, "Shubham@YRK"),
    ("004", "Raj", "Bhise", GenderEnum.MALE, "Raj@YRK"),
    ("005", "Abhay", "Nadgauda Arun", GenderEnum.MALE, "Abhay@YRK"),
    ("006", "Neha", "Seth", GenderEnum.FEMALE, "Neha@YRK"),
    ("007", "Mahantappa", "Awate Bhimasha", GenderEnum.MALE, "Mahantappa@YRK"),
    ("008", "Digvijay", "Yelgaonkar Suresh", GenderEnum.MALE, "Digvijay@YRK"),
    ("009", "Mahesh", "Shelke Sanjay", GenderEnum.MALE, "Mahesh@YRK"),
    ("010", "Jyotiram", "Bhusare Kuber", GenderEnum.MALE, "Jyotiram@YRK"),
    ("011", "Rohit", "Bhusare Gajendra", GenderEnum.MALE, "Rohit@YRK"),
    ("012", "Rushikesh", "Gaikwad Prashant", GenderEnum.MALE, "Rushikesh@YRK"),
    ("014", "Sachin", "Sakatkar Bharatrao", GenderEnum.MALE, "Sachin@YRK"),
    ("015", "Vishal", "Kate Vyankatrao", GenderEnum.MALE, "Vishal@YRK"),
    ("016", "Umesh", "Nemade Krishna", GenderEnum.MALE, "Umesh@YRK"),
    ("017", "Aditya", "Dhande Vijaykumar", GenderEnum.MALE, "Aditya@YRK"),
    ("018", "Pruthviraj", "Bhalke", GenderEnum.MALE, "Pruthviraj@YRK"),
    ("019", "Bhimrao", "Kumbhar Sangappa", GenderEnum.MALE, "Bhimrao@YRK"),
    ("020", "Prashant", "Jadhav", GenderEnum.MALE, "Prashant@YRK"),  # Peon
]

DEFAULT_PASSWORD = "123456"
DATE_OF_JOINING = date(2026, 7, 1)


def remove_test_employee(db):
    emp = db.query(Employee).filter_by(employee_code=TEST_EMPLOYEE_CODE).first()
    if not emp:
        print(f"  No test employee '{TEST_EMPLOYEE_CODE}' found — nothing to remove")
        return

    user = db.query(User).filter_by(employee_id=emp.id).first()

    db.query(Attendance).filter_by(employee_id=emp.id).delete()
    db.query(LeaveBalance).filter_by(employee_id=emp.id).delete()
    db.query(Leave).filter_by(employee_id=emp.id).delete()
    db.query(Leave).filter_by(applied_by=emp.id).delete()
    db.query(CompOff).filter_by(employee_id=emp.id).delete()
    db.query(Notification).filter_by(employee_id=emp.id).delete()

    if user:
        db.query(Notification).filter_by(user_id=user.id).delete()
        db.delete(user)
        db.flush()

    db.delete(emp)
    db.flush()
    print(f"  Removed test employee '{TEST_EMPLOYEE_CODE}' and all linked records")


def setup_employees(db):
    company = db.query(Company).filter_by(id=1).first()
    if not company:
        raise RuntimeError("Company id=1 not found — seed the base company first")

    construction_dept = db.query(Department).filter_by(company_id=company.id, name="Construction").first()
    morning_shift = db.query(Shift).filter_by(company_id=company.id, name="Morning Shift").first()
    employee_role = db.query(Role).filter_by(slug="employee").first()
    if not employee_role:
        raise RuntimeError("Role 'employee' not found — run scripts/seed.py first")

    created = 0
    skipped = 0
    for code, first, last, gender, username in EMPLOYEES:
        existing = db.query(Employee).filter_by(employee_code=code).first()
        if existing:
            skipped += 1
            continue

        email = f"{first.lower()}.{code}@yrkventures.local"

        emp = Employee(
            company_id=company.id,
            department_id=construction_dept.id if construction_dept else None,
            designation_id=None,
            shift_id=morning_shift.id if morning_shift else None,
            manager_id=None,
            employee_code=code,
            first_name=first,
            last_name=last,
            email=email,
            date_of_joining=DATE_OF_JOINING,
            gender=gender,
            employment_type=EmploymentTypeEnum.FULL_TIME,
        )
        db.add(emp)
        db.flush()

        user = User(
            email=email,
            username=username,
            password_hash=hash_password(DEFAULT_PASSWORD),
            role_id=employee_role.id,
            employee_id=emp.id,
            is_active=True,
        )
        db.add(user)
        created += 1

    db.flush()
    print(f"  Created {created} new employees, skipped {skipped} already present")


def main():
    db = SessionLocal()
    try:
        print("Removing test employee...")
        remove_test_employee(db)

        print("Setting up YRK Ventures employees...")
        setup_employees(db)

        db.commit()
        print("\nDone.")
        print(f"  All {len(EMPLOYEES)} employees log in with their Username + password '{DEFAULT_PASSWORD}'")
        print("  Example: Rohan@YRK / 123456")
    except Exception as e:
        db.rollback()
        print(f"Setup failed, rolled back: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
