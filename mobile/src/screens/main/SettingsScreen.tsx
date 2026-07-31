import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, ThemePalette } from "../../theme/ThemeContext";

export const SettingsScreen = () => {
  const [pushEnabled, setPushEnabled] = React.useState(true);
  const [locationEnabled, setLocationEnabled] = React.useState(true);
  const { colors, spacing, radius, isDark, toggleTheme } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, spacing, radius), [colors, spacing, radius]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.header}>App Settings</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>Dark Mode</Text>
              <Text style={styles.rowSubtitle}>Switch between light and dark appearance</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>Push Notifications</Text>
              <Text style={styles.rowSubtitle}>Attendance & Leave updates</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={[styles.row, styles.rowLast]}>
            <View>
              <Text style={styles.rowTitle}>Location Services</Text>
              <Text style={styles.rowSubtitle}>GPS validation on check-in</Text>
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={setLocationEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        <Text style={styles.footer}>AttendHR Mobile v1.0.0</Text>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: ThemePalette, spacing: any, radius: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
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
      borderColor: colors.border,
      borderWidth: 1,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    rowSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    footer: {
      textAlign: "center",
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: spacing.xl,
    },
  });
