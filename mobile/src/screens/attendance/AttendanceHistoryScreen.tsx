import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Linking,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, radius, spacing } from "../../theme/tokens";
import apiClient from "../../api/client";
import { FadeInView } from "../../components/FadeInView";
import { SkeletonBlock } from "../../components/SkeletonBlock";

const API_HOST = (apiClient.defaults.baseURL ?? "").replace(/\/api\/v1\/?$/, "");

// Selfie paths come back either as a Cloudinary absolute URL or a local
// "/uploads/..." relative path (dev / STORAGE_BACKEND=local).
const resolvePhotoUrl = (path?: string | null): string | undefined => {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_HOST}${path}`;
};

interface AttendanceRecord {
  id: number;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  working_hours: number | null;
  status: string;
}

interface AttendanceDetail extends AttendanceRecord {
  check_in_photo_path?: string | null;
  check_in_address?: string | null;
  check_in_google_maps_url?: string | null;
  check_in_gps_accuracy?: number | null;
  check_out_photo_path?: string | null;
  check_out_address?: string | null;
  check_out_google_maps_url?: string | null;
  check_out_gps_accuracy?: number | null;
  checkout_task_summary?: string | null;
}

export const AttendanceHistoryScreen = () => {
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedDetail, setSelectedDetail] = useState<AttendanceDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const loadData = () => {
    apiClient.get("/attendance/my-history?page_size=30")
      .then(({ data }) => {
        setHistory(Array.isArray(data) ? data : data?.data ?? []);
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

  const openDetail = (id: number) => {
    setIsModalVisible(true);
    setIsDetailLoading(true);
    setSelectedDetail(null);
    apiClient.get(`/attendance/${id}`)
      .then(({ data }) => setSelectedDetail(data))
      .catch(() => setIsModalVisible(false))
      .finally(() => setIsDetailLoading(false));
  };

  const closeDetail = () => {
    setIsModalVisible(false);
    setSelectedDetail(null);
  };

  const renderItem = ({ item }: { item: AttendanceRecord }) => {
    const isPresent = item.status === "present";
    const isLate = item.status === "late";
    const badgeColor = isPresent ? "#059669" : isLate ? "#D97706" : "#7C3AED";
    const badgeBg = isPresent ? "rgba(5,150,105,0.12)" : isLate ? "rgba(217,119,6,0.12)" : "rgba(124,58,237,0.12)";

    return (
      <TouchableOpacity style={styles.card} onPress={() => openDetail(item.id)} activeOpacity={0.7}>
        <View style={styles.row}>
          <Text style={styles.dateText}>
            {new Date(item.date).toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </Text>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{item.status.replace(/_/g, " ").toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.timeRow}>
          <View style={styles.timeCell}>
            <Feather name="log-in" size={13} color={colors.textSecondary} />
            <View>
              <Text style={styles.timeLabel}>Check-In</Text>
              <Text style={styles.timeValue}>{item.check_in_time ?? "—"}</Text>
            </View>
          </View>
          <View style={styles.timeCell}>
            <Feather name="log-out" size={13} color={colors.textSecondary} />
            <View>
              <Text style={styles.timeLabel}>Check-Out</Text>
              <Text style={styles.timeValue}>{item.check_out_time ?? "—"}</Text>
            </View>
          </View>
          <View style={styles.timeCell}>
            <Feather name="clock" size={13} color={colors.textSecondary} />
            <View>
              <Text style={styles.timeLabel}>Hours</Text>
              <Text style={styles.timeValue}>
                {item.working_hours ? `${item.working_hours}h` : "—"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.tapHintRow}>
          <Text style={styles.tapHint}>Tap for photo, location & task details</Text>
          <Feather name="chevron-right" size={14} color={colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Feather name="clock" size={20} color={colors.textPrimary} />
          <Text style={styles.title}>Attendance History</Text>
        </View>

        {isLoading ? (
          <View style={styles.list}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} height={92} borderRadius={radius.card} style={{ marginBottom: spacing.md }} />
            ))}
          </View>
        ) : (
          <FadeInView style={{ flex: 1 }}>
            <FlatList
              data={history}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Feather name="calendar" size={32} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyText}>No attendance records logged yet.</Text>
                </View>
              }
            />
          </FadeInView>
        )}
      </View>

      {/* Detail Modal — photo, location & task summary */}
      <Modal visible={isModalVisible} animationType="slide" transparent onRequestClose={closeDetail}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attendance Detail</Text>
              <TouchableOpacity onPress={closeDetail}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {isDetailLoading || !selectedDetail ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
                <Text style={styles.modalDate}>
                  {new Date(selectedDetail.date).toLocaleDateString("en-IN", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </Text>

                {/* Check-In */}
                <Text style={styles.sectionLabel}>CHECK-IN</Text>
                <View style={styles.detailCard}>
                  {selectedDetail.check_in_photo_path ? (
                    <Image
                      source={{ uri: resolvePhotoUrl(selectedDetail.check_in_photo_path) }}
                      style={styles.photo}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>No photo</Text>
                    </View>
                  )}
                  <Text style={styles.detailTime}>⏰ {selectedDetail.check_in_time ?? "—"}</Text>
                  {selectedDetail.check_in_address && (
                    <Text style={styles.detailAddress}>📍 {selectedDetail.check_in_address}</Text>
                  )}
                  {selectedDetail.check_in_gps_accuracy != null && (
                    <Text style={styles.detailGps}>Accuracy: {selectedDetail.check_in_gps_accuracy}m</Text>
                  )}
                  {selectedDetail.check_in_google_maps_url && (
                    <TouchableOpacity onPress={() => Linking.openURL(selectedDetail.check_in_google_maps_url!)}>
                      <Text style={styles.mapLink}>Open in Maps →</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Check-Out */}
                <Text style={styles.sectionLabel}>CHECK-OUT</Text>
                <View style={styles.detailCard}>
                  {selectedDetail.check_out_photo_path ? (
                    <Image
                      source={{ uri: resolvePhotoUrl(selectedDetail.check_out_photo_path) }}
                      style={styles.photo}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>Not checked out yet</Text>
                    </View>
                  )}
                  {selectedDetail.check_out_time && <Text style={styles.detailTime}>⏰ {selectedDetail.check_out_time}</Text>}
                  {selectedDetail.check_out_address && (
                    <Text style={styles.detailAddress}>📍 {selectedDetail.check_out_address}</Text>
                  )}
                  {selectedDetail.check_out_gps_accuracy != null && (
                    <Text style={styles.detailGps}>Accuracy: {selectedDetail.check_out_gps_accuracy}m</Text>
                  )}
                  {selectedDetail.check_out_google_maps_url && (
                    <TouchableOpacity onPress={() => Linking.openURL(selectedDetail.check_out_google_maps_url!)}>
                      <Text style={styles.mapLink}>Open in Maps →</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Task Summary */}
                {selectedDetail.checkout_task_summary && (
                  <>
                    <Text style={styles.sectionLabel}>TODAY'S TASKS</Text>
                    <View style={styles.detailCard}>
                      <Text style={styles.taskText}>{selectedDetail.checkout_task_summary}</Text>
                    </View>
                  </>
                )}

                {selectedDetail.working_hours != null && (
                  <Text style={styles.workingHoursText}>Total: {selectedDetail.working_hours}h worked</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
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
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  dateText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.badge,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  timeCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  tapHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: spacing.sm,
  },
  tapHint: {
    fontSize: 11,
    color: colors.primary,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: 20,
    color: colors.textSecondary,
    padding: 4,
  },
  modalDate: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  photo: {
    width: "100%",
    height: 180,
    borderRadius: radius.input,
    marginBottom: spacing.sm,
  },
  photoPlaceholder: {
    width: "100%",
    height: 100,
    borderRadius: radius.input,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  photoPlaceholderText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  detailTime: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 2,
  },
  detailAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailGps: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "500",
  },
  mapLink: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 6,
  },
  taskText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  workingHoursText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
