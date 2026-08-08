import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, radius, spacing } from "../../theme/tokens";
import apiClient from "../../api/client";
import { showAlert } from "../../utils/alert";
import { FadeInView } from "../../components/FadeInView";
import { hapticLight, hapticSuccess, hapticError } from "../../utils/haptics";

interface Balance {
  leave_type_id: number;
  leave_type_code?: string;
  leave_type_name?: string;
  balance_days: number;
}

export const ApplyLeaveScreen = ({ navigation }: any) => {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [totalDays, setTotalDays] = useState("1");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Set default dates
    const todayStr = new Date().toISOString().split("T")[0];
    setFromDate(todayStr);
    setToDate(todayStr);

    apiClient.get("/leaves/my-balances")
      .then(({ data }) => {
        const list: Balance[] = Array.isArray(data) ? data : data?.data ?? [];
        setBalances(list);
        if (list.length > 0) setSelectedTypeId(list[0].leave_type_id);
      })
      .catch(console.error);
  }, []);

  const selectedBalance = balances.find((b) => b.leave_type_id === selectedTypeId);

  const handleSubmit = async () => {
    hapticLight();
    if (!selectedTypeId || !fromDate || !toDate || !totalDays) {
      setError("Please fill in all required fields");
      hapticError();
      return;
    }
    setError("");
    setIsSubmitting(true);

    try {
      await apiClient.post("/leaves/apply", {
        leave_type_id: selectedTypeId,
        from_date: fromDate,
        to_date: toDate,
        total_days: parseFloat(totalDays),
        reason: reason.trim() || undefined,
      });

      hapticSuccess();
      showAlert("Leave application submitted successfully!");
      navigation.goBack();
    } catch (e: any) {
      hapticError();
      setError(e?.response?.data?.detail ?? "Failed to submit leave application");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={{ flex: 1 }} translateY={12}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Feather name="edit-3" size={20} color={colors.textPrimary} />
          <Text style={styles.header}>Apply for Leave</Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={14} color="#E11D48" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Balance Indicator Chips */}
        <Text style={styles.sectionLabel}>Available Balances</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.balanceRow}>
          {balances.map((b) => {
            const isSelected = b.leave_type_id === selectedTypeId;
            return (
              <TouchableOpacity
                key={b.leave_type_id}
                style={[styles.balanceChip, isSelected && styles.balanceChipSelected]}
                onPress={() => setSelectedTypeId(b.leave_type_id)}
              >
                <Text style={[styles.balanceChipCode, isSelected && styles.balanceChipCodeSelected]}>
                  {b.leave_type_code ?? "LEAVE"}
                </Text>
                <Text style={[styles.balanceChipDays, isSelected && styles.balanceChipDaysSelected]}>
                  {b.balance_days} days
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.formCard}>
          {/* Selected Type info */}
          {selectedBalance && (
            <View style={styles.selectedTypeBox}>
              <Text style={styles.selectedTypeName}>{selectedBalance.leave_type_name}</Text>
              <Text style={styles.selectedTypeDetail}>Available: {selectedBalance.balance_days} days remaining</Text>
            </View>
          )}

          <View style={styles.labelRow}>
            <Feather name="calendar" size={13} color={colors.textSecondary} />
            <Text style={styles.label}>From Date (YYYY-MM-DD) *</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={fromDate}
            onChangeText={setFromDate}
          />

          <View style={styles.labelRow}>
            <Feather name="calendar" size={13} color={colors.textSecondary} />
            <Text style={styles.label}>To Date (YYYY-MM-DD) *</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={toDate}
            onChangeText={setToDate}
          />

          <View style={styles.labelRow}>
            <Feather name="hash" size={13} color={colors.textSecondary} />
            <Text style={styles.label}>Total Days *</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="1.0"
            keyboardType="numeric"
            value={totalDays}
            onChangeText={setTotalDays}
          />

          <View style={styles.labelRow}>
            <Feather name="message-square" size={13} color={colors.textSecondary} />
            <Text style={styles.label}>Reason</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="State the reason for your leave request…"
            multiline
            numberOfLines={3}
            value={reason}
            onChangeText={setReason}
          />

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Feather name="send" size={15} color="#FFF" />
                <Text style={styles.submitButtonText}>Submit Leave Application</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      </FadeInView>
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
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(225, 29, 72, 0.12)",
    borderColor: "rgba(225, 29, 72, 0.3)",
    borderWidth: 1,
    borderRadius: radius.input,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  errorText: {
    color: "#E11D48",
    fontSize: 13,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  balanceRow: {
    flexDirection: "row",
    marginBottom: spacing.lg,
  },
  balanceChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    alignItems: "center",
  },
  balanceChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  balanceChipCode: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  balanceChipCodeSelected: {
    color: "#FFF",
  },
  balanceChipDays: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 2,
  },
  balanceChipDaysSelected: {
    color: "#FFF",
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderColor: colors.border,
    borderWidth: 1,
  },
  selectedTypeBox: {
    backgroundColor: "rgba(79,70,229,0.08)",
    padding: spacing.md,
    borderRadius: radius.input,
    marginBottom: spacing.base,
  },
  selectedTypeName: {
    fontWeight: "700",
    fontSize: 14,
    color: colors.primary,
  },
  selectedTypeDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  submitButton: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
