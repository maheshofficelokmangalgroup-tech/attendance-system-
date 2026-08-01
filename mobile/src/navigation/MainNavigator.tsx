import React, { useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { DashboardScreen } from "../screens/main/DashboardScreen";
import { NotificationsScreen } from "../screens/main/NotificationsScreen";
import { ProfileScreen } from "../screens/main/ProfileScreen";
import { SettingsScreen } from "../screens/main/SettingsScreen";
import { colors } from "../theme/tokens";

import { AttendanceHistoryScreen } from "../screens/attendance/AttendanceHistoryScreen";
import { CheckInScreen } from "../screens/attendance/CheckInScreen";
import { CheckOutScreen } from "../screens/attendance/CheckOutScreen";

import { LeaveHistoryScreen } from "../screens/leave/LeaveHistoryScreen";
import { ApplyLeaveScreen } from "../screens/leave/ApplyLeaveScreen";

import apiClient from "../api/client";
import { setNotifications } from "../redux/slices/notificationSlice";
import { RootState, AppDispatch } from "../redux/store";

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Dashboard: "home",
  Attendance: "clock",
  Leave: "calendar",
  Notifications: "bell",
  Settings: "settings",
  Profile: "user",
};

export const MainNavigator = () => {
  const dispatch = useDispatch<AppDispatch>();
  const unreadCount = useSelector((state: RootState) => state.notifications.unread_count);

  // Populate the unread badge as soon as the app loads, not just after the
  // user has opened the Notifications tab at least once.
  useEffect(() => {
    apiClient
      .get("/notifications?page_size=50")
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data?.data ?? [];
        dispatch(setNotifications(list));
      })
      .catch(() => {});
  }, [dispatch]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarIcon: ({ color, size }) =>
          TAB_ICONS[route.name] ? (
            <Feather name={TAB_ICONS[route.name]} size={size ?? 20} color={color} />
          ) : null,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Attendance" component={AttendanceHistoryScreen} />
      <Tab.Screen name="Leave" component={LeaveHistoryScreen} />
      <Tab.Screen name="CheckIn" component={CheckInScreen} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="CheckOut" component={CheckOutScreen} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="ApplyLeave" component={ApplyLeaveScreen} options={{ tabBarButton: () => null }} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarBadge: unreadCount > 0 ? unreadCount : undefined }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};
