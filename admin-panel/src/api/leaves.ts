import apiClient from "./client";

export interface LeaveItem {
  id: number;
  employee_id: number;
  employee?: {
    id: number;
    employee_code: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    department_name?: string;
  };
  leave_type_id: number;
  leave_type?: {
    id: number;
    name: string;
    code: string;
    days_per_year: number;
    is_paid: boolean;
  };
  from_date: string;
  to_date: string;
  total_days: number;
  reason?: string;
  status: string;
  applied_by: number;
  first_approver_id?: number;
  first_approval_status: string;
  first_approval_at?: string;
  final_approver_id?: number;
  final_approval_status: string;
  final_approval_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalanceItem {
  id: number;
  employee_id: number;
  leave_type_id: number;
  leave_type_name?: string;
  leave_type_code?: string;
  year: number;
  total_days: number;
  used_days: number;
  balance_days: number;
}

export interface TeamCalendarItem {
  id: number;
  employee_id: number;
  employee_name: string;
  department_name?: string;
  leave_type_code: string;
  leave_type_name: string;
  from_date: string;
  to_date: string;
  total_days: number;
  status: string;
}

export const fetchApprovalQueue = async (): Promise<LeaveItem[]> => {
  const response = await apiClient.get("/leaves/approval-queue");
  return response.data;
};

export const fetchTeamCalendar = async (fromDate: string, toDate: string): Promise<TeamCalendarItem[]> => {
  const response = await apiClient.get("/leaves/team-calendar", {
    params: { company_id: 1, from_date: fromDate, to_date: toDate },
  });
  return response.data;
};

export const fetchAllLeaves = async (params: {
  company_id: number;
  page?: number;
  page_size?: number;
  department_id?: number;
  status?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}) => {
  const response = await apiClient.get("/leaves", { params });
  return response.data;
};

export const fetchMyBalances = async (): Promise<LeaveBalanceItem[]> => {
  const response = await apiClient.get("/leaves/my-balances");
  return response.data;
};

export const approveFirstLevel = async (id: number, remarks?: string) => {
  const response = await apiClient.post(`/leaves/${id}/approve-first`, { remarks });
  return response.data;
};

export const approveFinalLevel = async (id: number, remarks?: string) => {
  const response = await apiClient.post(`/leaves/${id}/approve-final`, { remarks });
  return response.data;
};

export const rejectLeave = async (id: number, remarks: string) => {
  const response = await apiClient.post(`/leaves/${id}/reject`, { remarks });
  return response.data;
};
