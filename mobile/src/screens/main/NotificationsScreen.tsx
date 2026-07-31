import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "../../theme/tokens";
import apiClient from "../../api/client";

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export const NotificationsScreen = () => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const response = await apiClient.get("/notifications?page_size=50");
      const list = Array.isArray(response.data) ? response.data : response.data?.data ?? [];
      setItems(list);
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

  const handleMarkRead = async (id: number) => {
    try {
      await apiClient.post(`/notifications/${id}/read`);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    } catch (err) {
      console.error(err);
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    return (
      <TouchableOpacity
        style={[styles.card, !item.is_read && styles.unreadCard]}
        onPress={() => !item.is_read && handleMarkRead(item.id)}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, !item.is_read && styles.unreadTitle]}>{item.title}</Text>
          <Text style={styles.cardTime}>
            {new Date(item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        <Text style={styles.cardBody}>{item.body}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.header}>Notifications</Text>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No notifications yet</Text>
                <Text style={styles.emptyText}>
                  You will receive push notifications when leave requests get approved or attendance flags are raised.
                </Text>
              </View>
            }
          />
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
  header: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  card: {
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
