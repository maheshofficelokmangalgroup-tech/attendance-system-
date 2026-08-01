import React from "react";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { store } from "./src/redux/store";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { AuthBootstrap } from "./src/auth/AuthBootstrap";

export default function App() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <AuthBootstrap>
          <ThemeProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </ThemeProvider>
        </AuthBootstrap>
      </Provider>
    </SafeAreaProvider>
  );
}
