import apiClient from "./client";

export interface AttendanceItem {
  id: number;
  employee_id: number;
  employee?: {
    id: number;
    employee_code: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    photo_path?: string;
  };
  date: string;
  check_in_time?: string;
  check_in_photo_path?: string;
  check_in_latitude?: number;
  check_in_longitude?: number;
  check_in_address?: string;
  check_in_google_maps_url?: string;
  check_in_gps_accuracy?: number;

  check_out_time?: string;
  check_out_photo_path?: string;
  check_out_latitude?: number;
  check_out_longitude?: number;
  check_out_address?: string;
  check_out_google_maps_url?: string;
  check_out_gps_accuracy?: number;
  checkout_task_summary?: string;

  working_hours?: number;
  status: string;
  remarks?: string;
  is_regularized: boolean;
  device_logs?: Array<{
    id: number;
    action_type: string;
    device_id?: string;
    device_model?: string;
    os_version?: string;
    app_version?: string;
    ip_address?: string;
    connection_type?: string;
    latitude?: number;
    longitude?: number;
    gps_accuracy?: number;
    photo_path?: string;
    captured_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface AttendanceTodaySummaryData {
  total_employees: number;
  present_today: number;
  absent_today: number;
  late_today: number;
  on_leave_today: number;
  wfh_today: number;
  on_duty_today: number;
}

export const fetchAttendanceList = async (params: {
  company_id: number;
  page?: number;
  page_size?: number;
  department_id?: number;
  status?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}) => {
  const response = await apiClient.get("/attendance", { params });
  return response.data;
};

export const fetchTodaySummary = async (company_id: number = 1): Promise<AttendanceTodaySummaryData> => {
  const response = await apiClient.get("/attendance/today-summary", { params: { company_id } });
  return response.data;
};

export const fetchAttendanceDetail = async (id: number): Promise<AttendanceItem> => {
  const response = await apiClient.get(`/attendance/${id}`);
  return response.data;
};

export const regularizeAttendance = async (
  id: number,
  payload: { status: string; remarks: string; check_in_time?: string; check_out_time?: string }
) => {
  const response = await apiClient.post(`/attendance/${id}/regularize`, payload);
  return response.data;
};
