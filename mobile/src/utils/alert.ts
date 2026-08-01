import { Alert, Platform } from "react-native";

/**
 * react-native-web's Alert.alert() is a hard no-op (`static alert() {}`) —
 * every call to it on web silently does nothing, with no error, no warning.
 * That made every failure path in the app (permission denials, GPS/camera
 * errors, failed check-in/check-out/leave requests) invisible on the web
 * build: the button would just stop spinning with zero feedback, looking
 * exactly like the action never happened. Route web through window.alert
 * instead; native platforms keep using the real Alert.alert.
 */
export function showAlert(title: string, message?: string): void {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
