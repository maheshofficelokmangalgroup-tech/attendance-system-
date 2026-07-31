import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { colors, radius, spacing, shadows } from "../../theme/tokens";
import apiClient from "../../api/client";

type Step = "primer" | "capture" | "review" | "success";

export const CheckInScreen = ({ navigation }: any) => {
  const [step, setStep] = useState<Step>("primer");
  const [currentTime, setCurrentTime] = useState("");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState("Locating…");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [checkInResult, setCheckInResult] = useState<any>(null);
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
    if (accuracy <= 20) return "#059669"; // Green
    if (accuracy <= 50) return "#D97706"; // Amber
    return "#E11D48"; // Red
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
      // Show coordinates immediately, then upgrade to a real place name once
      // the (slower) reverse-geocode lookup resolves.
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);

      try {
        // Location.reverseGeocodeAsync uses the native OS geocoder, which isn't
        // available on web — call the same free Nominatim API the backend uses
        // so the address resolves consistently on every platform.
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { Accept: "application/json" } }
        );
        const geo = await resp.json();
        if (geo?.display_name) setAddress(geo.display_name);
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
        Alert.alert("Permissions Required", "Camera and Location permissions are both required to check in.");
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

  const handleConfirmCheckIn = async () => {
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

      if (Platform.OS === "web") {
        // React Native's { uri, name, type } FormData shorthand only works via
        // RN's native networking bridge — a real browser's FormData needs an
        // actual Blob, so fetch the captured photo back into one first.
        const photoBlob = await (await fetch(photoPath)).blob();
        formData.append("photo", photoBlob, "selfie.jpg");
      } else {
        formData.append("photo", {
          uri: photoPath,
          name: "selfie.jpg",
          type: "image/jpeg",
        } as any);
      }

      const response = await apiClient.post("/attendance/check-in", formData, {
        // apiClient defaults to Content-Type: application/json — on web that
        // must be cleared (not just omitted) so the browser can set its own
        // multipart boundary; passing `undefined` here still inherits the
        // JSON default, so explicitly null it out for this one request.
        headers: Platform.OS === "web" ? { "Content-Type": undefined } : { "Content-Type": "multipart/form-data" },
      });

      setCheckInResult(response.data);
      setStep("success");
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (e: any) {
      Alert.alert(e?.response?.data?.detail ?? "Check-in failed");
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
            AttendHR uses selfie verification and live GPS coordinates to ensure secure, authentic attendance check-ins at your company location.
          </Text>

          <View style={styles.primerCard}>
            <Text style={styles.primerCardHeader}>Why we ask:</Text>
            <Text style={styles.primerCardItem}>• Selfie photo verifies identity</Text>
            <Text style={styles.primerCardItem}>• GPS confirms on-site / WFH location</Text>
            <Text style={styles.primerCardItem}>• Data stored encrypted per privacy policy</Text>
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

            {/* GPS Accuracy Chip */}
            <View style={[styles.gpsChip, { borderColor: getAccuracyColor(gpsAccuracy ?? 999) }]}>
              <View style={[styles.gpsDot, { backgroundColor: getAccuracyColor(gpsAccuracy ?? 999) }]} />
              <Text style={styles.gpsChipText}>
                GPS Accuracy: {gpsAccuracy ?? "—"}m {(gpsAccuracy ?? 0) > 50 ? "(Move to open area)" : ""}
              </Text>
            </View>

            {/* Live Clock & Address */}
            <View style={styles.locationOverlay}>
              <Text style={styles.clockText}>{currentTime}</Text>
              <Text style={styles.addressText}>📍 {address}</Text>
            </View>
          </View>

          {/* Capture Controls */}
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
      {/* STEP 3: Review Screen */}
      {/* ---------------------------------------------------------------- */}
      {step === "review" && (
        <View style={styles.reviewContainer}>
          <Text style={styles.reviewTitle}>Confirm Check-In</Text>
          
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
              <Text style={styles.detailTime}>⏰ Check-In Time: {currentTime}</Text>
              <Text style={styles.detailAddress}>📍 Location: {address}</Text>
              <Text style={styles.detailGps}>Accuracy: {gpsAccuracy ?? "—"}m (Verified)</Text>
            </View>
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
              onPress={handleConfirmCheckIn}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Confirm & Check In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* STEP 4: Success Screen */}
      {/* ---------------------------------------------------------------- */}
      {step === "success" && (
        <View style={styles.successContainer}>
          <View style={styles.successCheckCircle}>
            <Text style={styles.successCheckMark}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Checked In Successfully!</Text>
          <Text style={styles.successTime}>
            {currentTime} · Status: {checkInResult?.status ?? "PRESENT"}
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
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
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
    marginBottom: spacing.xl,
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
