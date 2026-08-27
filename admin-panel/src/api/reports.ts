import apiClient from "./client";

export interface DailyTrendItem {
  date: string;
  present: number;
  absent: number;
  late: number;
  on_leave: number;
  wfh: number;
}

export interface DepartmentDistributionItem {
  department_id: number;
  department_name: string;
  employee_count: number;
  present_today: number;
}

export interface ActivityFeedItem {
  id: string;
  event_type: string;
  title: string;
  subtitle: string;
  timestamp: string;
  employee_name: string;
  employee_code: string;
}

export interface DashboardAnalyticsData {
  kpis: {
    total_employees: number;
    present_today: number;
    absent_today: number;
    late_today: number;
    on_leave_today: number;
    wfh_today: number;
    on_duty_today: number;
  };
  trend_30_days: DailyTrendItem[];
  department_distribution: DepartmentDistributionItem[];
  recent_activity: ActivityFeedItem[];
}

export interface MusterRollRow {
  employee_id: number;
  employee_code: string;
  full_name: string;
  department_name?: string;
  days: Record<number, string>;
  total_present: number;
  total_absent: number;
  total_leave: number;
}

export interface MusterRollData {
  year: number;
  month: number;
  total_days: number;
  rows: MusterRollRow[];
}

export interface GenericReportData {
  report_type: string;
  title: string;
  generated_at: string;
  headers: string[];
  rows: any[][];
  total_records: number;
}

export const fetchDashboardAnalytics = async (company_id: number = 1): Promise<DashboardAnalyticsData> => {
  const response = await apiClient.get("/reports/dashboard-analytics", { params: { company_id } });
  return response.data;
};

export const fetchMusterRoll = async (year: number, month: number, department_id?: number): Promise<MusterRollData> => {
  const response = await apiClient.get("/reports/muster-roll", {
    params: { company_id: 1, year, month, department_id },
  });
  return response.data;
};

export const fetchReportData = async (report_type: string, from_date?: string, to_date?: string, department_id?: number): Promise<GenericReportData> => {
  const response = await apiClient.get(`/reports/${report_type}`, {
    params: { company_id: 1, from_date, to_date, department_id },
  });
  return response.data;
};

// Downloads a file via an authenticated axios request (blob), then saves it
// through a temporary object URL. A plain `window.open()`/navigation would
// not attach the Bearer token, so every export would 403 — this is required.
const downloadBlob = async (url: string, params: Record<string, unknown>, filename: string) => {
  const response = await apiClient.get(url, { params, responseType: "blob" });
  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};

export interface ReportExportFilters {
  from_date?: string;
  to_date?: string;
  department_id?: number;
  year?: number;
  month?: number;
}

export const downloadReportCSV = (report_type: string, filters: ReportExportFilters = {}) => {
  return downloadBlob(`/reports/${report_type}/export`, { company_id: 1, ...filters }, `${report_type}_report.csv`);
};

export const downloadReportExcel = (report_type: string, filters: ReportExportFilters = {}) => {
  return downloadBlob(`/reports/${report_type}/export-excel`, { company_id: 1, ...filters }, `${report_type}_report.xlsx`);
};

export const downloadEmployeeExcelReport = (employeeId: number, fromDate: string, toDate: string, employeeName: string) => {
  return downloadBlob(
    `/reports/employee/${employeeId}/export-excel`,
    { from_date: fromDate, to_date: toDate },
    `attendance_${employeeName.replace(/\s+/g, "_")}_${fromDate}_to_${toDate}.xlsx`
  );
};
