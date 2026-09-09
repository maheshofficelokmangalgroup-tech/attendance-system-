import apiClient from "./client";

export interface WfhItem {
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
  from_date: string;
  to_date: string;
  reason: string;
  status: string;
  approver_id?: number;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export const fetchPendingWfh = async (): Promise<WfhItem[]> => {
  const response = await apiClient.get("/wfh/pending");
  return response.data;
};

export const fetchAllWfh = async (params: {
  company_id: number;
  page?: number;
  page_size?: number;
  department_id?: number;
  status?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}) => {
  const response = await apiClient.get("/wfh", { params });
  return response.data;
};

export const approveWfh = async (id: number) => {
  const response = await apiClient.post(`/wfh/${id}/approve`);
  return response.data;
};

export const rejectWfh = async (id: number, reason: string) => {
  const response = await apiClient.post(`/wfh/${id}/reject`, { reason });
  return response.data;
};
