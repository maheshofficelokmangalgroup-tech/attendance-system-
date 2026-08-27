"""Reports API router — /api/v1/reports"""
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.models.user import User
from app.services.report_service import ReportService
from app.schemas.reports import DashboardAnalyticsResponse, MusterRollReportResponse, GenericReportResponse
from app.schemas.common import APIResponse
from app.utils.timezone import today_ist

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])


@router.get("/dashboard-analytics", response_model=APIResponse[DashboardAnalyticsResponse], summary="Get real-time dashboard analytics, trends, and feed")
def dashboard_analytics(
    company_id: int = Query(default=1),
    current_user: User = Depends(require_permission("view", "report")),
    db: Session = Depends(get_db),
):
    svc = ReportService(db)
    return APIResponse(data=svc.get_dashboard_analytics(company_id=company_id))


@router.get("/muster-roll", response_model=APIResponse[MusterRollReportResponse], summary="Get Monthly Muster Roll Matrix (Grid days 1-31)")
def muster_roll(
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    company_id: int = Query(default=1),
    department_id: Optional[int] = Query(default=None),
    current_user: User = Depends(require_permission("view", "report")),
    db: Session = Depends(get_db),
):
    svc = ReportService(db)
    today = today_ist()
    return APIResponse(data=svc.get_muster_roll(
        company_id=company_id,
        year=year if year is not None else today.year,
        month=month if month is not None else today.month,
        department_id=department_id,
    ))


@router.get("/{report_type}", response_model=APIResponse[GenericReportResponse], summary="Get JSON data for any of the 10 report types")
def get_report_data(
    report_type: str,
    company_id: int = Query(default=1),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    department_id: Optional[int] = Query(default=None),
    current_user: User = Depends(require_permission("view", "report")),
    db: Session = Depends(get_db),
):
    svc = ReportService(db)
    return APIResponse(data=svc.generate_report(report_type, company_id, from_date, to_date, department_id))


@router.get("/{report_type}/export", summary="Export report to CSV file download")
def export_report_csv(
    report_type: str,
    company_id: int = Query(default=1),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    department_id: Optional[int] = Query(default=None),
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    current_user: User = Depends(require_permission("export", "report")),
    db: Session = Depends(get_db),
):
    svc = ReportService(db)
    csv_content = svc.export_csv(report_type, company_id, from_date, to_date, department_id, year, month)
    filename = f"{report_type}_report_{today_ist().strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{report_type}/export-excel", summary="Export report to a styled .xlsx file download")
def export_report_excel(
    report_type: str,
    company_id: int = Query(default=1),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    department_id: Optional[int] = Query(default=None),
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    current_user: User = Depends(require_permission("export", "report")),
    db: Session = Depends(get_db),
):
    svc = ReportService(db)
    xlsx_bytes = svc.export_excel(report_type, company_id, from_date, to_date, department_id, year, month)
    filename = f"{report_type}_report_{today_ist().strftime('%Y%m%d')}.xlsx"

    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/employee/{employee_id}/export-excel",
    summary="Export one employee's attendance + daily task summaries for a date range as a real .xlsx file",
)
def export_employee_excel(
    employee_id: int,
    from_date: date = Query(...),
    to_date: date = Query(...),
    current_user: User = Depends(require_permission("export", "report")),
    db: Session = Depends(get_db),
):
    if to_date < from_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="to_date cannot be before from_date")
    if (to_date - from_date).days > 366:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Date range cannot exceed 1 year")

    svc = ReportService(db)
    xlsx_bytes = svc.generate_employee_excel_report(employee_id, from_date, to_date)
    filename = f"attendance_{employee_id}_{from_date.strftime('%Y%m%d')}_{to_date.strftime('%Y%m%d')}.xlsx"

    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
