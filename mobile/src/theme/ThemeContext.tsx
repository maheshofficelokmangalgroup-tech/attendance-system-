import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors as tokens, spacing, radius, shadows } from "./tokens";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "@attendhr/theme_mode";

function buildPalette(isDark: boolean) {
  return {
    isDark,
    primary: tokens.primary,
    accent: isDark ? tokens.accentDark : tokens.accent,
    background: isDark ? tokens.backgroundDark : tokens.background,
    surface: isDark ? tokens.surfaceDark : tokens.surface,
    border: isDark ? tokens.borderDark : tokens.border,
    textPrimary: isDark ? tokens.textPrimaryDark : tokens.textPrimary,
    textSecondary: isDark ? tokens.textSecondaryDark : tokens.textSecondary,
    status: tokens.status,
  };
}

export type ThemePalette = ReturnType<typeof buildPalette>;

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemePalette;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // System (OS-level) light/dark preference — only consulted if the user
  // explicitly switches mode to "system" from Settings. Defaulting to "light"
  // (not "system") means the app is always white out of the box, regardless
  // of the phone's OS dark-mode setting.
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark" || saved === "system") {
          setModeState(saved);
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const isDark = mode === "system" ? systemScheme === "dark" : mode === "dark";

  const toggleTheme = () => {
    setMode(isDark ? "light" : "dark");
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark,
      colors: buildPalette(isDark),
      spacing,
      radius,
      shadows,
      setMode,
      toggleTheme,
    }),
    [mode, isDark]
  );

  // Skip the first frame until we've read any persisted preference from disk,
  // so the UI doesn't flash the system default and then jump to the saved one.
  if (!hydrated) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme() must be used within a <ThemeProvider>");
  }
  return ctx;
}
