import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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

const Tab = createBottomTabNavigator();

export const MainNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Attendance" component={AttendanceHistoryScreen} />
      <Tab.Screen name="Leave" component={LeaveHistoryScreen} />
      <Tab.Screen name="CheckIn" component={CheckInScreen} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="CheckOut" component={CheckOutScreen} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="ApplyLeave" component={ApplyLeaveScreen} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};
