"""Pydantic v2 DTOs — Dashboard Analytics & 10 Enterprise Reports."""
from __future__ import annotations
from datetime import date, datetime, time
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DailyTrendItem(BaseModel):
    date: str  # YYYY-MM-DD
    present: int = 0
    absent: int = 0
    late: int = 0
    on_leave: int = 0
    wfh: int = 0


class DepartmentDistributionItem(BaseModel):
    department_id: int
    department_name: str
    employee_count: int = 0
    present_today: int = 0


class ActivityFeedItem(BaseModel):
    id: str
    event_type: str  # check_in | check_out | leave_applied | leave_approved
    title: str
    subtitle: str
    timestamp: datetime
    employee_name: str
    employee_code: str


class DashboardAnalyticsResponse(BaseModel):
    kpis: Dict[str, Any]
    trend_30_days: List[DailyTrendItem]
    department_distribution: List[DepartmentDistributionItem]
    recent_activity: List[ActivityFeedItem]


# ---------------------------------------------------------------------------
# Report Items
# ---------------------------------------------------------------------------

class MusterRollRow(BaseModel):
    employee_id: int
    employee_code: str
    full_name: str
    department_name: Optional[str] = None
    days: Dict[int, str]  # day 1..31 -> "P" | "A" | "L" | "HD" | "OL" | "HO" | "WO"
    total_present: float = 0.0
    total_absent: float = 0.0
    total_leave: float = 0.0


class MusterRollReportResponse(BaseModel):
    year: int
    month: int
    total_days: int
    rows: List[MusterRollRow]


class GenericReportResponse(BaseModel):
    report_type: str
    title: str
    generated_at: datetime
    headers: List[str]
    rows: List[List[Any]]
    total_records: int
