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

interface AttendanceRecord {
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
}

const PRESENT_STATUSES = ["present", "late", "half_day", "early_exit", "on_duty", "comp_off"];
const LEAVE_STATUSES = ["on_leave", "lwp"];

export const DashboardScreen = ({ navigation }: any) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const { colors, spacing, radius, shadows } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, spacing, radius, shadows), [colors, spacing, radius, shadows]);

  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = useCallback(() => {
    setIsLoading(true);
    apiClient
      .get("/attendance/my-history?page_size=31")
      .then(({ data }) => {
        setHistory(Array.isArray(data) ? data : data?.data ?? []);
      })
      .catch(() => setHistory([]))
      .finally(() => setIsLoading(false));
  }, []);

  // Refetch every time this screen regains focus (e.g. returning from Check-In/Out)
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const todayStr = new Date().toISOString().split("T")[0];
  const today = history.find((r) => r.date === todayStr) ?? null;

  const currentMonthKey = todayStr.slice(0, 7); // "YYYY-MM"
  const thisMonth = history.filter((r) => r.date.startsWith(currentMonthKey));
  const monthlyStats = {
    present: thisMonth.filter((r) => PRESENT_STATUSES.includes(r.status)).length,
    late: thisMonth.filter((r) => r.status === "late").length,
    leave: thisMonth.filter((r) => LEAVE_STATUSES.includes(r.status)).length,
    wfh: thisMonth.filter((r) => r.status === "wfh").length,
  };

  const recentLogs = history.slice(0, 5);

  const formatStatus = (status: string) =>
    status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const formatLogDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

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
            <Text style={styles.statNumber}>{isLoading ? "—" : monthlyStats.present}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{isLoading ? "—" : monthlyStats.late}</Text>
            <Text style={styles.statLabel}>Late</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{isLoading ? "—" : monthlyStats.leave}</Text>
            <Text style={styles.statLabel}>Leave</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{isLoading ? "—" : monthlyStats.wfh}</Text>
            <Text style={styles.statLabel}>WFH</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Logs</Text>
        {isLoading ? (
          <View style={styles.activityCard}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : recentLogs.length === 0 ? (
          <View style={styles.activityCard}>
            <Text style={styles.placeholderText}>
              Attendance history and leave records will populate here once logged.
            </Text>
          </View>
        ) : (
          <View style={styles.activityCard}>
            {recentLogs.map((log, i) => (
              <View
                key={log.date}
                style={[styles.logRow, i < recentLogs.length - 1 && styles.logRowDivider]}
              >
                <Text style={styles.logDate}>{formatLogDate(log.date)}</Text>
                <Text style={styles.logDetail}>
                  {log.check_in_time ? log.check_in_time.slice(0, 5) : "—"}
                  {"  →  "}
                  {log.check_out_time ? log.check_out_time.slice(0, 5) : "—"}
                </Text>
                <Text style={[styles.logStatus, { color: statusColor(log.status) }]}>
                  {formatStatus(log.status)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const statusColor = (status: string) => {
  if (status === "present") return "#059669";
  if (status === "late") return "#D97706";
  if (status === "absent") return "#E11D48";
  if (["on_leave", "lwp"].includes(status)) return "#0D9488";
  return "#64748B";
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
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  logRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logDate: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
    width: 56,
  },
  logDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    textAlign: "center",
  },
  logStatus: {
    fontSize: 12,
    fontWeight: "600",
    width: 72,
    textAlign: "right",
  },
});
