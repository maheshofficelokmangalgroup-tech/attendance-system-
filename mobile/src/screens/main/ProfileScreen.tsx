import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Feather } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { colors, radius, spacing } from "../../theme/tokens";
import { RootState } from "../../redux/store";
import { clearAuth } from "../../redux/slices/authSlice";
import apiClient, { resolvePhotoUrl } from "../../api/client";
import { FadeInView } from "../../components/FadeInView";
import { hapticLight, hapticSuccess, hapticError } from "../../utils/haptics";
import { showAlert } from "../../utils/alert";

type DocField = "aadhar_front" | "aadhar_back" | "pan_photo" | "degree_certificate";

interface KycData {
  aadhar_front_path?: string | null;
  aadhar_back_path?: string | null;
  pan_photo_path?: string | null;
  degree_certificate_path?: string | null;
}

const DOC_FIELDS: { key: DocField; label: string }[] = [
  { key: "aadhar_front", label: "Aadhar Front" },
  { key: "aadhar_back", label: "Aadhar Back" },
  { key: "pan_photo", label: "PAN Card" },
  { key: "degree_certificate", label: "Degree Certificate" },
];

const pathForField = (kyc: KycData | null, field: DocField): string | null | undefined => {
  if (!kyc) return null;
  if (field === "aadhar_front") return kyc.aadhar_front_path;
  if (field === "aadhar_back") return kyc.aadhar_back_path;
  if (field === "pan_photo") return kyc.pan_photo_path;
  return kyc.degree_certificate_path;
};

export const ProfileScreen = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const refreshToken = useSelector((state: RootState) => state.auth.refresh_token);

  const [kyc, setKyc] = React.useState<KycData | null>(null);
  const [isLoadingKyc, setIsLoadingKyc] = React.useState(true);
  const [uploadingField, setUploadingField] = React.useState<DocField | null>(null);

  React.useEffect(() => {
    apiClient.get("/employees/me/kyc")
      .then(({ data }) => setKyc((data?.data ?? data) ?? null))
      .catch(console.error)
      .finally(() => setIsLoadingKyc(false));
  }, []);

  const uploadDocument = async (field: DocField, uri: string, mimeType: string, fileName: string) => {
    hapticLight();
    setUploadingField(field);
    try {
      const formData = new FormData();
      if (Platform.OS === "web") {
        // React Native's { uri, name, type } FormData shorthand only works
        // via RN's native networking bridge — a real browser's FormData
        // needs an actual Blob, so fetch the picked file back into one first.
        const blob = await (await fetch(uri)).blob();
        formData.append(field, blob, fileName);
      } else {
        formData.append(field, { uri, name: fileName, type: mimeType } as any);
      }

      const response = await apiClient.post("/employees/me/kyc/documents", formData, {
        headers: Platform.OS === "web" ? { "Content-Type": undefined } : { "Content-Type": "multipart/form-data" },
      });
      setKyc((response.data?.data ?? response.data) ?? null);
      hapticSuccess();
    } catch (e: any) {
      hapticError();
      showAlert(e?.response?.data?.detail ?? "Failed to upload document");
    } finally {
      setUploadingField(null);
    }
  };

  const pickImage = async (field: DocField) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert("Photo library access is needed to upload this document.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await uploadDocument(field, asset.uri, asset.mimeType ?? "image/jpeg", asset.fileName ?? `${field}.jpg`);
  };

  const pickCertificate = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await uploadDocument("degree_certificate", asset.uri, asset.mimeType ?? "application/pdf", asset.name ?? "degree_certificate.pdf");
  };

  const handlePick = (field: DocField) => {
    if (field === "degree_certificate") {
      pickCertificate();
    } else {
      pickImage(field);
    }
  };

  const handleLogout = () => {
    hapticLight();
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
      <FadeInView style={styles.content} translateY={12}>
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
              {user?.employee_code ?? "Not Linked"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>MY DOCUMENTS (KYC)</Text>
        {isLoadingKyc ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: spacing.xl }} />
        ) : (
          <View style={styles.docGrid}>
            {DOC_FIELDS.map(({ key, label }) => {
              const path = pathForField(kyc, key);
              const isUploaded = Boolean(path);
              const isPdf = typeof path === "string" && path.toLowerCase().endsWith(".pdf");
              const isUploading = uploadingField === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.docTile}
                  onPress={() => handlePick(key)}
                  disabled={isUploading}
                  activeOpacity={0.8}
                >
                  <View style={styles.docPreview}>
                    {isUploading ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : isUploaded && !isPdf ? (
                      <Image source={{ uri: resolvePhotoUrl(path) }} style={styles.docPreviewImg} />
                    ) : isUploaded && isPdf ? (
                      <Feather name="file-text" size={22} color={colors.primary} />
                    ) : (
                      <Feather name="upload" size={18} color={colors.textSecondary} />
                    )}
                  </View>
                  <Text style={styles.docLabel}>{label}</Text>
                  <Text style={[styles.docStatus, isUploaded && styles.docStatusDone]}>
                    {isUploading ? "Uploading…" : isUploaded ? "Uploaded · Tap to change" : "Tap to upload"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
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
  sectionLabel: {
    width: "100%",
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  docGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  docTile: {
    width: "47%",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    alignItems: "center",
  },
  docPreview: {
    width: 56,
    height: 56,
    borderRadius: radius.input,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
    overflow: "hidden",
  },
  docPreviewImg: {
    width: "100%",
    height: "100%",
  },
  docLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
  docStatus: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 2,
  },
  docStatusDone: {
    color: "#059669",
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
