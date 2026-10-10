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
  total_days: number;
  used_days: number;
  is_paid?: boolean;
  max_consecutive_days?: number | null;
}

// Only these are offered when applying — Casual/Sick leave (paid, capped per
// request), COL/Comp Off (paid, earned by working Sundays, usable only within
// the month it's earned), and PWL/unpaid leave (always available, no balance cap).
const APPLICABLE_CODES = ["CL", "SL", "COL", "PWL"];

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
        const visible = list.filter((b) => APPLICABLE_CODES.includes(b.leave_type_code ?? ""));
        setBalances(visible);
        if (visible.length > 0) setSelectedTypeId(visible[0].leave_type_id);
      })
      .catch(console.error);
  }, []);

  const selectedBalance = balances.find((b) => b.leave_type_id === selectedTypeId);

  // Both paid types (CL + SL) exhausted -> only PWL is meaningfully usable.
  const paidBalances = balances.filter((b) => b.is_paid !== false);
  const paidExhausted = paidBalances.length > 0 && paidBalances.every((b) => b.balance_days <= 0);
  const combinedPaidTotal = paidBalances.reduce((sum, b) => sum + (b.total_days ?? 0), 0);
  const pwlBalance = balances.find((b) => b.leave_type_code === "PWL");

  useEffect(() => {
    if (paidExhausted && pwlBalance && selectedBalance?.is_paid !== false) {
      setSelectedTypeId(pwlBalance.leave_type_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidExhausted, pwlBalance?.leave_type_id]);

  const dayRangeSpan = (() => {
    if (!fromDate || !toDate) return null;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
    return Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  })();

  // Sundays inside the picked range are never charged as leave — shown here
  // so the employee isn't surprised when fewer days get deducted than typed.
  const sundaysInRange = (() => {
    if (!fromDate || !toDate) return 0;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return 0;
    let count = 0;
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0) count++;
    }
    return count;
  })();

  const handleSubmit = async () => {
    hapticLight();
    if (!selectedTypeId || !fromDate || !toDate || !totalDays) {
      setError("Please fill in all required fields");
      hapticError();
      return;
    }
    if (
      selectedBalance?.max_consecutive_days &&
      dayRangeSpan !== null &&
      dayRangeSpan > selectedBalance.max_consecutive_days
    ) {
      setError(
        `${selectedBalance.leave_type_name ?? "This leave type"} can only be requested for up to ${selectedBalance.max_consecutive_days} consecutive day(s) at a time. You selected ${dayRangeSpan} day(s).`
      );
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

        {paidExhausted && (
          <View style={styles.quotaBanner}>
            <Feather name="info" size={14} color={colors.primary} />
            <Text style={styles.quotaBannerText}>
              Your {combinedPaidTotal} day(s) of paid leave is completed — you can take PWL (unpaid).
            </Text>
          </View>
        )}

        {/* Balance Indicator Chips */}
        <Text style={styles.sectionLabel}>Available Balances</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.balanceRow}>
          {balances.map((b) => {
            const isSelected = b.leave_type_id === selectedTypeId;
            // Paid types (CL/SL) become unselectable once exhausted — PWL is
            // never disabled this way since it has no fixed balance to run out.
            const isExhausted = b.is_paid !== false && b.balance_days <= 0;
            return (
              <TouchableOpacity
                key={b.leave_type_id}
                style={[
                  styles.balanceChip,
                  isSelected && styles.balanceChipSelected,
                  isExhausted && styles.balanceChipDisabled,
                ]}
                onPress={() => !isExhausted && setSelectedTypeId(b.leave_type_id)}
                disabled={isExhausted}
              >
                <Text style={[styles.balanceChipCode, isSelected && styles.balanceChipCodeSelected]}>
                  {b.leave_type_code ?? "LEAVE"}
                </Text>
                <Text style={[styles.balanceChipDays, isSelected && styles.balanceChipDaysSelected]}>
                  {b.is_paid === false ? `${b.used_days} taken` : isExhausted ? "Exhausted" : `${b.balance_days} days`}
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
              <Text style={styles.selectedTypeDetail}>
                {selectedBalance.is_paid === false
                  ? `Unpaid — salary is cut for these days. You've taken ${selectedBalance.used_days} day(s) via PWL this year.`
                  : `Available: ${selectedBalance.balance_days} days remaining`}
                {selectedBalance.max_consecutive_days
                  ? ` · max ${selectedBalance.max_consecutive_days} consecutive day(s) per request`
                  : ""}
              </Text>
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
          {sundaysInRange > 0 && (
            <Text style={styles.sundayHint}>
              {sundaysInRange} Sunday{sundaysInRange > 1 ? "s" : ""} in this range won't be charged — only{" "}
              {Math.max(0, parseFloat(totalDays || "0") - sundaysInRange)} day(s) will be deducted.
            </Text>
          )}

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
  quotaBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(79,70,229,0.08)",
    borderColor: "rgba(79,70,229,0.25)",
    borderWidth: 1,
    borderRadius: radius.input,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  quotaBannerText: {
    color: colors.primary,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
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
  balanceChipDisabled: {
    opacity: 0.45,
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
  sundayHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 15,
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
