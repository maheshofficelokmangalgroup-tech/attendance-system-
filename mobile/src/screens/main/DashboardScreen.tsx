import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme, ThemePalette } from "../../theme/ThemeContext";
import { RootState } from "../../redux/store";
import apiClient from "../../api/client";

interface TodayAttendance {
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
}

export const DashboardScreen = ({ navigation }: any) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const { colors, spacing, radius, shadows } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, spacing, radius, shadows), [colors, spacing, radius, shadows]);

  const [today, setToday] = useState<TodayAttendance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadTodayStatus = useCallback(() => {
    setIsLoading(true);
    apiClient
      .get("/attendance/my-history?page_size=1")
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data?.data ?? [];
        const latest = list[0];
        const todayStr = new Date().toISOString().split("T")[0];
        setToday(latest && latest.date === todayStr ? latest : null);
      })
      .catch(() => setToday(null))
      .finally(() => setIsLoading(false));
  }, []);

  // Refetch every time this screen regains focus (e.g. returning from Check-In/Out)
  useFocusEffect(
    useCallback(() => {
      loadTodayStatus();
    }, [loadTodayStatus])
  );

  const hasCheckedIn = !!today?.check_in_time;
  const hasCheckedOut = !!today?.check_out_time;

  const statusLabel = hasCheckedOut
    ? "Checked Out"
    : hasCheckedIn
    ? "Checked In"
    : "Not Checked In";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.userName}>{user?.full_name ?? user?.email}</Text>
          </View>
          <View style={styles.roleChip}>
            <Text style={styles.roleText}>{user?.role_name ?? "Employee"}</Text>
          </View>
        </View>

        {/* Check-In / Check-Out CTA Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Today's Attendance</Text>
          <Text style={styles.heroSubtitle}>
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : (
            <>
              <View
                style={[
                  styles.statusBadge,
                  hasCheckedOut && styles.statusBadgeDone,
                  hasCheckedIn && !hasCheckedOut && styles.statusBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    hasCheckedOut && styles.statusBadgeTextDone,
                    hasCheckedIn && !hasCheckedOut && styles.statusBadgeTextActive,
                  ]}
                >
                  {statusLabel}
                  {hasCheckedIn ? ` · In: ${today?.check_in_time?.slice(0, 5)}` : ""}
                  {hasCheckedOut ? ` · Out: ${today?.check_out_time?.slice(0, 5)}` : ""}
                </Text>
              </View>

              {hasCheckedOut ? (
                <View style={styles.checkInButton}>
                  <Text style={styles.checkInButtonText}>✓ Done for today</Text>
                </View>
              ) : hasCheckedIn ? (
                <TouchableOpacity
                  style={[styles.checkInButton, { backgroundColor: "#D97706" }]}
                  onPress={() => navigation.navigate("CheckOut")}
                >
                  <Text style={styles.checkInButtonText}>📷  Selfie & GPS Check-Out</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.checkInButton}
                  onPress={() => navigation.navigate("CheckIn")}
                >
                  <Text style={styles.checkInButtonText}>📷  Selfie & GPS Check-In</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Summary Grid */}
        <Text style={styles.sectionTitle}>Monthly Overview</Text>
        <View style={styles.grid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>—</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>—</Text>
            <Text style={styles.statLabel}>Late</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>—</Text>
            <Text style={styles.statLabel}>Leave</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>—</Text>
            <Text style={styles.statLabel}>WFH</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Logs</Text>
        <View style={styles.activityCard}>
          <Text style={styles.placeholderText}>
            Attendance history and leave records will populate here once logged.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ThemePalette, spacing: any, radius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.base,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  roleChip: {
    backgroundColor: "rgba(79, 70, 229, 0.12)",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.badge,
  },
  roleText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 12,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "500",
    marginBottom: spacing.md,
  },
  statusBadge: {
    backgroundColor: "rgba(217, 119, 6, 0.12)",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.badge,
    marginBottom: spacing.lg,
  },
  statusBadgeActive: {
    backgroundColor: "rgba(5, 150, 105, 0.12)",
  },
  statusBadgeDone: {
    backgroundColor: "rgba(79, 70, 229, 0.12)",
  },
  statusBadgeText: {
    color: "#D97706",
    fontSize: 13,
    fontWeight: "600",
  },
  statusBadgeTextActive: {
    color: "#059669",
  },
  statusBadgeTextDone: {
    color: colors.primary,
  },
  checkInButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: "100%",
    alignItems: "center",
  },
  checkInButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    width: "48%",
    marginBottom: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
});
