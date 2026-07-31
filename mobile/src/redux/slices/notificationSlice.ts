import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationState {
  items: NotificationItem[];
  unread_count: number;
}

const initialState: NotificationState = {
  items: [],
  unread_count: 0,
};

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    setNotifications(state, action: PayloadAction<NotificationItem[]>) {
      state.items = action.payload;
      state.unread_count = action.payload.filter((n) => !n.is_read).length;
    },
    markAsRead(state, action: PayloadAction<number>) {
      const item = state.items.find((n) => n.id === action.payload);
      if (item && !item.is_read) {
        item.is_read = true;
        state.unread_count = Math.max(0, state.unread_count - 1);
      }
    },
  },
});

export const { setNotifications, markAsRead } = notificationSlice.actions;
export default notificationSlice.reducer;
