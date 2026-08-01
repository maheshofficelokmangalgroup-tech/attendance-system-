import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";
import { colors, radius, spacing } from "../../theme/tokens";
import { RootState } from "../../redux/store";
import { clearAuth } from "../../redux/slices/authSlice";
import apiClient from "../../api/client";

export const ProfileScreen = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const refreshToken = useSelector((state: RootState) => state.auth.refresh_token);

  const handleLogout = () => {
    // Best-effort: revoke the refresh token server-side so it can't be
    // replayed. Log out locally either way — a failed revoke shouldn't
    // trap the user in a signed-in state.
    if (refreshToken) {
      apiClient.post("/auth/logout", { refresh_token: refreshToken }).catch(() => {});
    }
    dispatch(clearAuth());
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.full_name?.[0]?.toUpperCase() ?? "U"}
          </Text>
        </View>

        <Text style={styles.name}>{user?.full_name ?? "Employee"}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{user?.role_name ?? "Employee"}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>User ID</Text>
            <Text style={styles.rowValue}>#{user?.id}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Employee ID</Text>
            <Text style={styles.rowValue}>
              {user?.employee_id ? `#${user.employee_id}` : "Not Linked"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
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
    padding: spacing.lg,
    alignItems: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  avatarText: {
    color: "#FFF",
    fontSize: 32,
    fontWeight: "700",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  badge: {
    backgroundColor: "rgba(79, 70, 229, 0.12)",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.badge,
    marginBottom: spacing.xl,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  rowValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  logoutButton: {
    width: "100%",
    backgroundColor: "rgba(225, 29, 72, 0.1)",
    borderColor: "rgba(225, 29, 72, 0.3)",
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  logoutButtonText: {
    color: "#E11D48",
    fontSize: 15,
    fontWeight: "600",
  },
});
