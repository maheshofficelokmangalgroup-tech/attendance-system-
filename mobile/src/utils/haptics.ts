import * as Haptics from "expo-haptics";

// expo-haptics is a documented no-op on web/unsupported hardware, but wrap in
// .catch anyway so a haptics call can never be the thing that breaks a flow.
export const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
export const hapticSuccess = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
export const hapticError = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
export const hapticSelection = () => Haptics.selectionAsync().catch(() => {});
