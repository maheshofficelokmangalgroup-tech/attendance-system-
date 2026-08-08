import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, radius, spacing } from "../../theme/tokens";
import apiClient from "../../api/client";
import { showAlert } from "../../utils/alert";
import { FadeInView } from "../../components/FadeInView";
import { BounceInView } from "../../components/BounceInView";
import { SkeletonBlock } from "../../components/SkeletonBlock";

interface LeaveRecord {
  id: number;
  leave_type?: { code: string; name: string };
  from_date: string;
  to_date: string;
  total_days: number;
  reason: string | null;
  status: string;
}

const STATUS_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  APPROVED: "check-circle",
  FIRST_APPROVED: "check-circle",
  REJECTED: "x-circle",
  CANCELLED: "slash",
  PENDING: "clock",
};

export const LeaveHistoryScreen = ({ navigation }: any) => {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadData = () => {
    apiClient.get("/leaves/my-history?page_size=30")
      .then(({ data }) => {
        setLeaves(Array.isArray(data) ? data : data?.data ?? []);
      })
      .catch(console.error)
      .finally(() => {
        setIsLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancel = async (id: number) => {
    if (cancellingId !== null) return; // ignore rapid repeat taps while a request is in flight
    setCancellingId(id);
    try {
      await apiClient.post(`/leaves/${id}/cancel`);
      showAlert("Leave request cancelled");
      loadData();
    } catch (e: any) {
      showAlert(e?.response?.data?.detail ?? "Failed to cancel leave");
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED": return { text: "#059669", bg: "rgba(5,150,105,0.12)" };
      case "FIRST_APPROVED": return { text: "#0D9488", bg: "rgba(13,148,136,0.12)" };
      case "REJECTED": return { text: "#E11D48", bg: "rgba(225,29,72,0.12)" };
      case "CANCELLED": return { text: "#64748B", bg: "rgba(100,116,139,0.12)" };
      default: return { text: "#D97706", bg: "rgba(217,119,6,0.12)" };
    }
  };

  const renderItem = ({ item }: { item: LeaveRecord }) => {
    const statusStyle = getStatusColor(item.status);
    const statusIcon = STATUS_ICON[item.status.toUpperCase()] ?? "clock";
    const canCancel = item.status !== "CANCELLED" && item.status !== "REJECTED";
    const isApproved = item.status.toUpperCase() === "APPROVED" || item.status.toUpperCase() === "FIRST_APPROVED";

    const statusBadge = (
      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
        <Feather name={statusIcon} size={12} color={statusStyle.text} />
        <Text style={[styles.statusText, { color: statusStyle.text }]}>{item.status.replace(/_/g, " ")}</Text>
      </View>
    );

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.typeBadge}>
            <Feather name="calendar" size={12} color={colors.primary} />
            <Text style={styles.typeBadgeText}>{item.leave_type?.code ?? "PL"}</Text>
          </View>
          {isApproved ? <BounceInView>{statusBadge}</BounceInView> : statusBadge}
        </View>

        <Text style={styles.dateRange}>
          {item.from_date} to {item.to_date} · <Text style={{ fontWeight: "700" }}>{item.total_days} day(s)</Text>
        </Text>

        {item.reason ? (
          <Text style={styles.reasonText}>"{item.reason}"</Text>
        ) : null}

        {canCancel && (
          <TouchableOpacity
            style={[styles.cancelBtn, cancellingId === item.id && styles.buttonDisabled]}
            onPress={() => handleCancel(item.id)}
            disabled={cancellingId !== null}
            activeOpacity={0.7}
          >
            {cancellingId === item.id ? (
              <Text style={styles.cancelBtnText}>Cancelling…</Text>
            ) : (
              <>
                <Feather name="x" size={13} color="#E11D48" />
                <Text style={styles.cancelBtnText}>Cancel Request</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleRow}>
            <Feather name="calendar" size={20} color={colors.textPrimary} />
            <Text style={styles.header}>My Leave Requests</Text>
          </View>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => navigation.navigate("ApplyLeave")}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={14} color="#FFF" />
            <Text style={styles.applyBtnText}>Apply Leave</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View>
            {[0, 1, 2].map((i) => (
              <SkeletonBlock key={i} height={98} borderRadius={radius.card} style={{ marginBottom: spacing.md }} />
            ))}
          </View>
        ) : (
          <FadeInView style={{ flex: 1 }}>
            <FlatList
              data={leaves}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
              }
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Feather name="calendar" size={32} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyText}>No leave applications submitted yet.</Text>
                </View>
              }
            />
          </FadeInView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.base,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.button,
  },
  applyBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 13,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(79,70,229,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.badge,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dateRange: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginBottom: spacing.xs,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    marginTop: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelBtnText: {
    color: "#E11D48",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyBox: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
