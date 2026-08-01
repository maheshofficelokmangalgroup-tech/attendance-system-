import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { colors, radius, spacing } from "../../theme/tokens";
import apiClient from "../../api/client";
import { setNotifications, markAsRead, NotificationItem } from "../../redux/slices/notificationSlice";
import { RootState, AppDispatch } from "../../redux/store";

const ICONS_BY_TYPE: Record<string, keyof typeof Feather.glyphMap> = {
  leave_approved: "check-circle",
  leave_rejected: "x-circle",
  leave_first_approved: "check-circle",
  leave_applied: "calendar",
  attendance_flag: "alert-triangle",
};

export const NotificationsScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const items = useSelector((state: RootState) => state.notifications.items);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = async () => {
    try {
      const response = await apiClient.get("/notifications?page_size=50");
      const list = Array.isArray(response.data) ? response.data : response.data?.data ?? [];
      dispatch(setNotifications(list));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }
  }, [isLoading]);

  const handleMarkRead = async (id: number) => {
    try {
      await apiClient.post(`/notifications/${id}/read`);
      dispatch(markAsRead(id));
    } catch (err) {
      console.error(err);
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const iconName = ICONS_BY_TYPE[item.type] ?? "bell";
    return (
      <TouchableOpacity
        style={[styles.card, !item.is_read && styles.unreadCard]}
        onPress={() => !item.is_read && handleMarkRead(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBadge, !item.is_read && styles.iconBadgeUnread]}>
          <Feather name={iconName} size={16} color={item.is_read ? colors.textSecondary : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, !item.is_read && styles.unreadTitle]}>{item.title}</Text>
            <Text style={styles.cardTime}>
              {new Date(item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
          <Text style={styles.cardBody}>{item.body}</Text>
        </View>
        {!item.is_read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Feather name="bell" size={20} color={colors.textPrimary} />
          <Text style={styles.header}>Notifications</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <FlatList
              data={items}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Feather name="bell-off" size={32} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyTitle}>No notifications yet</Text>
                  <Text style={styles.emptyText}>
                    You will receive push notifications when leave requests get approved or attendance flags are raised.
                  </Text>
                </View>
              }
            />
          </Animated.View>
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
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.lg,
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderColor: colors.border,
    borderWidth: 1,
  },
  unreadCard: {
    backgroundColor: "rgba(79, 70, 229, 0.06)",
    borderColor: "rgba(79, 70, 229, 0.25)",
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  iconBadgeUnread: {
    backgroundColor: "rgba(79, 70, 229, 0.12)",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  unreadTitle: {
    fontWeight: "700",
    color: colors.primary,
  },
  cardTime: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  cardBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
});
