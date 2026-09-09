import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors, radius, spacing, shadows } from "../../theme/tokens";
import apiClient from "../../api/client";
import { showAlert, showConfirm } from "../../utils/alert";
import { FadeInView } from "../../components/FadeInView";
import { BounceInView } from "../../components/BounceInView";
import { hapticLight, hapticSuccess, hapticError } from "../../utils/haptics";

type Step = "primer" | "capture" | "review" | "success";

export const CheckOutScreen = ({ navigation }: any) => {
  const [step, setStep] = useState<Step>("primer");
  const [currentTime, setCurrentTime] = useState("");
  const [taskSummary, setTaskSummary] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [checkOutResult, setCheckOutResult] = useState<any>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Live clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleEnableAndContinue = async () => {
    if (isPreparing) return; // ignore rapid repeat taps while a request is in flight
    setIsPreparing(true);
    try {
      let cameraGranted = cameraPermission?.granted;
      if (!cameraGranted) {
        const result = await requestCameraPermission();
        cameraGranted = result.granted;
      }

      if (!cameraGranted) {
        showAlert("Permission Required", "Camera permission is required to check out.");
        return;
      }

      setStep("capture");
    } catch (e: any) {
      showAlert(
        "Could not enable camera",
        e?.message ?? "Please check your browser/app permissions and try again."
      );
    } finally {
      setIsPreparing(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;
    hapticLight();
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo) throw new Error("No photo returned");
      setPhotoPath(photo.uri);
      setStep("review");
    } catch (e) {
      hapticError();
      showAlert("Failed to capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleConfirmCheckOut = () => {
    if (isSubmitting) return; // ignore rapid repeat taps while a request is in flight
    if (!photoPath) {
      showAlert("Missing photo — please retake.");
      return;
    }
    showConfirm("Check Out?", "Are you sure you want to check out?", submitCheckOut);
  };

  const submitCheckOut = async () => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("device_model", Platform.select({ ios: "iPhone", default: "Android Device" }));
      formData.append("os_version", `${Platform.OS} ${Platform.Version}`);
      formData.append("app_version", "1.0.0");
      formData.append("connection_type", "unknown");
      if (taskSummary.trim()) {
        formData.append("task_summary", taskSummary.trim());
      }

      if (Platform.OS === "web") {
        // React Native's { uri, name, type } FormData shorthand only works via
        // RN's native networking bridge — a real browser's FormData needs an
        // actual Blob, so fetch the captured photo back into one first.
        const photoBlob = await (await fetch(photoPath)).blob();
        formData.append("photo", photoBlob, "checkout.jpg");
      } else {
        formData.append("photo", {
          uri: photoPath,
          name: "checkout.jpg",
          type: "image/jpeg",
        } as any);
      }

      const response = await apiClient.post("/attendance/check-out", formData, {
        // apiClient defaults to Content-Type: application/json — on web that
        // must be cleared (not just omitted) so the browser can set its own
        // multipart boundary; passing `undefined` here still inherits the
        // JSON default, so explicitly null it out for this one request.
        headers: Platform.OS === "web" ? { "Content-Type": undefined } : { "Content-Type": "multipart/form-data" },
      });

      setCheckOutResult(response.data);
      hapticSuccess();
      setStep("success");
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (e: any) {
      hapticError();
      showAlert(e?.response?.data?.detail ?? "Check-out failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ---------------------------------------------------------------- */}
      {/* STEP 1: Permission Primer */}
      {/* ---------------------------------------------------------------- */}
      {step === "primer" && (
        <FadeInView style={styles.primerContainer} translateY={12}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconCircleText}>📷</Text>
          </View>
          <Text style={styles.primerTitle}>Camera Required</Text>
          <Text style={styles.primerText}>
            AttendHR uses selfie verification to confirm your check-out, and asks what you worked on today.
          </Text>

          <View style={styles.primerCard}>
            <Text style={styles.primerCardHeader}>Why we ask:</Text>
            <Text style={styles.primerCardItem}>• Selfie photo verifies identity</Text>
            <Text style={styles.primerCardItem}>• Task summary helps your manager track daily work</Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleEnableAndContinue}
            disabled={isPreparing}
          >
            {isPreparing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Enable & Continue</Text>
            )}
          </TouchableOpacity>
        </FadeInView>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* STEP 2: Camera Capture */}
      {/* ---------------------------------------------------------------- */}
      {step === "capture" && (
        <FadeInView style={styles.captureContainer}>
          <View style={styles.viewfinder}>
            {cameraPermission?.granted ? (
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
            ) : (
              <ActivityIndicator color="#FFF" />
            )}
            <View style={styles.faceGuide} />
            <Text style={styles.faceGuideLabel}>Position face inside circle</Text>

            <View style={styles.clockOverlay}>
              <Text style={styles.clockText}>{currentTime}</Text>
            </View>
          </View>

          <View style={styles.controlsBar}>
            <TouchableOpacity
              style={[styles.captureBtn, isCapturing && styles.buttonDisabled]}
              onPress={handleCapture}
              disabled={!cameraPermission?.granted || isCapturing}
            >
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
          </View>
        </FadeInView>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* STEP 3: Review Screen (photo + task summary) */}
      {/* ---------------------------------------------------------------- */}
      {step === "review" && (
        <FadeInView style={{ flex: 1 }} translateY={12}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView contentContainerStyle={styles.reviewContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.reviewTitle}>Confirm Check-Out</Text>

            <View style={styles.previewCard}>
              {photoPath ? (
                <Image
                  source={{ uri: photoPath }}
                  style={styles.photoPlaceholder}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>No photo captured</Text>
                </View>
              )}

              <View style={styles.reviewDetails}>
                <Text style={styles.detailTime}>⏰ Check-Out Time: {currentTime}</Text>
              </View>
            </View>

            <View style={styles.taskCard}>
              <Text style={styles.taskLabel}>What did you work on today?</Text>
              <TextInput
                style={styles.taskInput}
                placeholder="e.g. Finished the API integration, fixed 2 bugs, attended sprint review…"
                placeholderTextColor={colors.textSecondary}
                value={taskSummary}
                onChangeText={setTaskSummary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.taskHint}>Optional, but helps your manager see today's work at a glance.</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setStep("capture")}
              >
                <Text style={styles.secondaryButtonText}>Retake Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1 }, isSubmitting && styles.buttonDisabled]}
                onPress={handleConfirmCheckOut}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Confirm & Check Out</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        </FadeInView>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* STEP 4: Success Screen */}
      {/* ---------------------------------------------------------------- */}
      {step === "success" && (
        <View style={styles.successContainer}>
          <BounceInView style={styles.successCheckCircle}>
            <Text style={styles.successCheckMark}>✓</Text>
          </BounceInView>
          <FadeInView translateY={10} duration={300}>
            <Text style={styles.successTitle}>Checked Out Successfully!</Text>
            <Text style={styles.successTime}>
              {currentTime} · {checkOutResult?.working_hours ? `${checkOutResult.working_hours}h worked` : "Have a great day!"}
            </Text>
            <Text style={styles.successSubtext}>Returning to dashboard…</Text>
          </FadeInView>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  primerContainer: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(79, 70, 229, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  iconCircleText: {
    fontSize: 36,
  },
  primerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  primerText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  primerCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderColor: colors.border,
    borderWidth: 1,
  },
  primerCardHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  primerCardItem: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  primaryButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  captureContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  viewfinder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  faceGuide: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
  },
  faceGuideLabel: {
    color: "#FFF",
    fontSize: 13,
    marginTop: spacing.md,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.badge,
  },
  clockOverlay: {
    position: "absolute",
    bottom: 30,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.card,
  },
  clockText: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "700",
  },
  controlsBar: {
    height: 100,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
  },
  reviewContainer: {
    padding: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  reviewTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderColor: colors.border,
    borderWidth: 1,
  },
  photoPlaceholder: {
    height: 220,
    backgroundColor: colors.background,
    borderRadius: radius.input,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  photoPlaceholderText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  reviewDetails: {
    gap: 6,
  },
  detailTime: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderColor: colors.border,
    borderWidth: 1,
  },
  taskLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  taskInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 90,
  },
  taskHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  successCheckCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  successCheckMark: {
    color: "#FFF",
    fontSize: 48,
    fontWeight: "700",
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  successTime: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  successSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
