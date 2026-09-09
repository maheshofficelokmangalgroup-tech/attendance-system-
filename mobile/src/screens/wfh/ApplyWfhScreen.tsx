import React, { useState } from "react";
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

export const ApplyWfhScreen = ({ navigation }: any) => {
  const todayStr = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    hapticLight();
    if (!fromDate || !toDate || !reason.trim()) {
      setError("Please fill in the dates and a reason");
      hapticError();
      return;
    }
    setError("");
    setIsSubmitting(true);

    try {
      await apiClient.post("/wfh/apply", {
        from_date: fromDate,
        to_date: toDate,
        reason: reason.trim(),
      });

      hapticSuccess();
      showAlert("WFH request submitted!", "Your manager will review it shortly.");
      // Sibling tab screens don't share a back-stack, so goBack() would land
      // on the first tab (Dashboard) instead of returning to WFH — navigate
      // there explicitly so the employee sees their new request right away.
      navigation.navigate("Wfh");
    } catch (e: any) {
      hapticError();
      setError(e?.response?.data?.detail ?? "Failed to submit WFH request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={{ flex: 1 }} translateY={12}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Feather name="monitor" size={20} color={colors.textPrimary} />
            <Text style={styles.header}>Apply for Work From Home</Text>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={14} color="#E11D48" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.formCard}>
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
              <Feather name="message-square" size={13} color={colors.textSecondary} />
              <Text style={styles.label}>Reason *</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Why are you requesting to work from home?"
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
                  <Text style={styles.submitButtonText}>Submit WFH Request</Text>
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
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderColor: colors.border,
    borderWidth: 1,
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
