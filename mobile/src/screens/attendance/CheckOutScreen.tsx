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
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { colors, radius, spacing, shadows } from "../../theme/tokens";
import apiClient from "../../api/client";

type Step = "primer" | "capture" | "review" | "success";

export const CheckOutScreen = ({ navigation }: any) => {
  const [step, setStep] = useState<Step>("primer");
  const [currentTime, setCurrentTime] = useState("");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState("Locating…");
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

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy <= 20) return "#059669";
    if (accuracy <= 50) return "#D97706";
    return "#E11D48";
  };

  const fetchCurrentLocation = async () => {
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude: lat, longitude: lng, accuracy } = position.coords;
      setLatitude(lat);
      setLongitude(lng);
      setGpsAccuracy(Math.round(accuracy ?? 999));
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);

      try {
        const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const place = results[0];
        if (place) {
          const line = [place.name, place.street, place.district || place.subregion, place.city, place.region]
            .filter((part, i, arr) => !!part && arr.indexOf(part) === i)
            .join(", ");
          if (line) setAddress(line);
        }
      } catch {
        // Reverse geocoding is best-effort — keep the coordinate fallback if it fails.
      }
    } catch {
      Alert.alert("Could not get your location. Please enable GPS and retry.");
    }
  };

  const handleEnableAndContinue = async () => {
    if (isPreparing) return; // ignore rapid repeat taps while a request is in flight
    setIsPreparing(true);
    try {
      let cameraGranted = cameraPermission?.granted;
      if (!cameraGranted) {
        const result = await requestCameraPermission();
        cameraGranted = result.granted;
      }

      const locationStatus = await Location.requestForegroundPermissionsAsync();

      if (!cameraGranted || locationStatus.status !== "granted") {
        Alert.alert("Permissions Required", "Camera and Location permissions are both required to check out.");
        return;
      }

      await fetchCurrentLocation();
      setStep("capture");
    } catch (e: any) {
      Alert.alert(
        "Could not enable camera/location",
        e?.message ?? "Please check your browser/app permissions and try again."
      );
    } finally {
      setIsPreparing(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo) throw new Error("No photo returned");
      setPhotoPath(photo.uri);
      setStep("review");
    } catch (e) {
      Alert.alert("Failed to capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleConfirmCheckOut = async () => {
    if (isSubmitting) return; // ignore rapid repeat taps while a request is in flight
    if (!photoPath || latitude === null || longitude === null || gpsAccuracy === null) {
      Alert.alert("Missing photo or location data — please retake.");
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("latitude", String(latitude));
      formData.append("longitude", String(longitude));
      formData.append("gps_accuracy", String(gpsAccuracy));
      formData.append("device_model", Platform.select({ ios: "iPhone", default: "Android Device" }));
      formData.append("os_version", `${Platform.OS} ${Platform.Version}`);
      formData.append("app_version", "1.0.0");
      formData.append("connection_type", "unknown");
      if (taskSummary.trim()) {
        formData.append("task_summary", taskSummary.trim());
      }

      formData.append("photo", {
        uri: photoPath,
        name: "checkout.jpg",
        type: "image/jpeg",
      } as any);

      const response = await apiClient.post("/attendance/check-out", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setCheckOutResult(response.data);
      setStep("success");
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (e: any) {
      Alert.alert(e?.response?.data?.detail ?? "Check-out failed");
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
        <View style={styles.primerContainer}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconCircleText}>📍📷</Text>
          </View>
          <Text style={styles.primerTitle}>Camera & Location Required</Text>
          <Text style={styles.primerText}>
            AttendHR uses selfie verification and live GPS coordinates to confirm your check-out, and asks what you worked on today.
          </Text>

          <View style={styles.primerCard}>
            <Text style={styles.primerCardHeader}>Why we ask:</Text>
            <Text style={styles.primerCardItem}>• Selfie photo verifies identity</Text>
            <Text style={styles.primerCardItem}>• GPS confirms on-site / WFH location</Text>
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
        </View>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* STEP 2: Camera Capture */}
      {/* ---------------------------------------------------------------- */}
      {step === "capture" && (
        <View style={styles.captureContainer}>
          <View style={styles.viewfinder}>
            {cameraPermission?.granted ? (
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
            ) : (
              <ActivityIndicator color="#FFF" />
            )}
            <View style={styles.faceGuide} />
            <Text style={styles.faceGuideLabel}>Position face inside circle</Text>

            <View style={[styles.gpsChip, { borderColor: getAccuracyColor(gpsAccuracy ?? 999) }]}>
              <View style={[styles.gpsDot, { backgroundColor: getAccuracyColor(gpsAccuracy ?? 999) }]} />
              <Text style={styles.gpsChipText}>
                GPS Accuracy: {gpsAccuracy ?? "—"}m {(gpsAccuracy ?? 0) > 50 ? "(Move to open area)" : ""}
              </Text>
            </View>

            <View style={styles.locationOverlay}>
              <Text style={styles.clockText}>{currentTime}</Text>
              <Text style={styles.addressText}>📍 {address}</Text>
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
        </View>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* STEP 3: Review Screen (photo + location + task summary) */}
      {/* ---------------------------------------------------------------- */}
      {step === "review" && (
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
                <Text style={styles.detailAddress}>📍 Location: {address}</Text>
                <Text style={styles.detailGps}>Accuracy: {gpsAccuracy ?? "—"}m (Verified)</Text>
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
      )}

      {/* ---------------------------------------------------------------- */}
      {/* STEP 4: Success Screen */}
      {/* ---------------------------------------------------------------- */}
      {step === "success" && (
        <View style={styles.successContainer}>
          <View style={styles.successCheckCircle}>
            <Text style={styles.successCheckMark}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Checked Out Successfully!</Text>
          <Text style={styles.successTime}>
            {currentTime} · {checkOutResult?.working_hours ? `${checkOutResult.working_hours}h worked` : "Have a great day!"}
          </Text>
          <Text style={styles.successSubtext}>Returning to dashboard…</Text>
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
  gpsChip: {
    position: "absolute",
    top: 40,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.badge,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  gpsChipText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  locationOverlay: {
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
  addressText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
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
  detailAddress: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  detailGps: {
    color: "#059669",
    fontSize: 12,
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
