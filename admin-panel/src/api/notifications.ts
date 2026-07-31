import apiClient from "./client";

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export const fetchNotifications = async (page: number = 1, page_size: number = 30) => {
  const response = await apiClient.get("/notifications", { params: { page, page_size } });
  return response.data;
};

export const markNotificationRead = async (id: number) => {
  const response = await apiClient.post(`/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await apiClient.post("/notifications/read-all");
  return response.data;
};
