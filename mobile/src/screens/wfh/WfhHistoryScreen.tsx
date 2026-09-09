import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { colors, radius, spacing } from "../../theme/tokens";
import apiClient from "../../api/client";
import { showAlert, showConfirm } from "../../utils/alert";
import { FadeInView } from "../../components/FadeInView";
import { BounceInView } from "../../components/BounceInView";
import { SkeletonBlock } from "../../components/SkeletonBlock";

interface WfhRecord {
  id: number;
  from_date: string;
  to_date: string;
  reason: string;
  status: string;
  rejection_reason: string | null;
}

const STATUS_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  APPROVED: "check-circle",
  REJECTED: "x-circle",
  CANCELLED: "slash",
  PENDING: "clock",
};

export const WfhHistoryScreen = ({ navigation }: any) => {
  const [requests, setRequests] = useState<WfhRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadData = () => {
    apiClient.get("/wfh/my-history?page_size=30")
      .then(({ data }) => {
        setRequests(Array.isArray(data) ? data : data?.data ?? []);
      })
      .catch(console.error)
      .finally(() => {
        setIsLoading(false);
        setRefreshing(false);
      });
  };

  // Reload every time this tab gains focus (not just on first mount) — bottom
  // tabs keep sibling screens mounted, so a plain useEffect would only ever
  // fire once and the list would go stale after applying/cancelling a request.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const doCancel = async (id: number) => {
    if (cancellingId !== null) return; // ignore rapid repeat taps while a request is in flight
    setCancellingId(id);
    try {
      await apiClient.post(`/wfh/${id}/cancel`);
      showAlert("WFH request cancelled");
      loadData();
    } catch (e: any) {
      showAlert(e?.response?.data?.detail ?? "Failed to cancel request");
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancel = (id: number) => {
    showConfirm("Cancel WFH Request?", "Are you sure you want to cancel this request?", () => doCancel(id));
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED": return { text: "#059669", bg: "rgba(5,150,105,0.12)" };
      case "REJECTED": return { text: "#E11D48", bg: "rgba(225,29,72,0.12)" };
      case "CANCELLED": return { text: "#64748B", bg: "rgba(100,116,139,0.12)" };
      default: return { text: "#D97706", bg: "rgba(217,119,6,0.12)" };
    }
  };

  const renderItem = ({ item }: { item: WfhRecord }) => {
    const statusStyle = getStatusColor(item.status);
    const statusIcon = STATUS_ICON[item.status.toUpperCase()] ?? "clock";
    const canCancel = item.status.toUpperCase() !== "CANCELLED" && item.status.toUpperCase() !== "REJECTED";
    const isApproved = item.status.toUpperCase() === "APPROVED";

    const statusBadge = (
      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
        <Feather name={statusIcon} size={12} color={statusStyle.text} />
        <Text style={[styles.statusText, { color: statusStyle.text }]}>{item.status}</Text>
      </View>
    );

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.typeBadge}>
            <Feather name="monitor" size={12} color={colors.primary} />
            <Text style={styles.typeBadgeText}>WFH</Text>
          </View>
          {isApproved ? <BounceInView>{statusBadge}</BounceInView> : statusBadge}
        </View>

        <Text style={styles.dateRange}>
          {item.from_date} to {item.to_date}
        </Text>

        {item.reason ? (
          <Text style={styles.reasonText}>"{item.reason}"</Text>
        ) : null}

        {item.status.toUpperCase() === "REJECTED" && item.rejection_reason ? (
          <Text style={styles.rejectionText}>Rejected: {item.rejection_reason}</Text>
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
            <Feather name="monitor" size={20} color={colors.textPrimary} />
            <Text style={styles.header}>My WFH Requests</Text>
          </View>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => navigation.navigate("ApplyWfh")}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={14} color="#FFF" />
            <Text style={styles.applyBtnText}>Apply WFH</Text>
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
              data={requests}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
              }
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Feather name="monitor" size={32} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyText}>No WFH requests submitted yet.</Text>
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
  rejectionText: {
    fontSize: 12,
    color: "#E11D48",
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
