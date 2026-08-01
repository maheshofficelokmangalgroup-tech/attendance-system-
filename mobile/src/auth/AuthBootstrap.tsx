import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDispatch } from "react-redux";
import { setAuth, updateTokens, clearAuth } from "../redux/slices/authSlice";
import { registerAuthCallbacks } from "../api/client";
import { AUTH_STORAGE_KEY } from "../redux/authPersistenceMiddleware";
import type { AppDispatch } from "../redux/store";

/**
 * Rehydrates the session from AsyncStorage before the navigator renders
 * (so a page reload doesn't flash the login screen before landing back on
 * the dashboard), and wires apiClient's silent-refresh callbacks so a
 * rotated token pair gets persisted and a truly expired refresh token
 * actually logs the user out.
 */
export const AuthBootstrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    registerAuthCallbacks({
      onTokensUpdated: (access_token, refresh_token) => {
        dispatch(updateTokens({ access_token, refresh_token }));
      },
      onAuthExpired: () => {
        dispatch(clearAuth());
      },
    });

    AsyncStorage.getItem(AUTH_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved?.access_token && saved?.refresh_token && saved?.user) {
          dispatch(setAuth(saved));
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, [dispatch]);

  if (!hydrated) return null;
  return <>{children}</>;
};
