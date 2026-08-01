import { Middleware } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuth, updateTokens, clearAuth } from "./slices/authSlice";

export const AUTH_STORAGE_KEY = "@attendhr/auth";

/**
 * Without this, the whole session lived only in Redux's in-memory state —
 * every page reload (browser refresh, a backgrounded tab getting discarded
 * by the OS, reopening the PWA after the phone was locked for a while) wiped
 * it, forcing a fresh login even though the refresh token was still good for
 * 30 more days. Persists on every login and silent token refresh, clears on
 * logout; AuthBootstrap reads it back on startup.
 */
export const authPersistenceMiddleware: Middleware = () => (next) => (action) => {
  const result = next(action);

  if (setAuth.match(action)) {
    AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(action.payload)).catch(() => {});
  } else if (updateTokens.match(action)) {
    AsyncStorage.getItem(AUTH_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        saved.access_token = action.payload.access_token;
        saved.refresh_token = action.payload.refresh_token;
        return AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(saved));
      })
      .catch(() => {});
  } else if (clearAuth.match(action)) {
    AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
  }

  return result;
};
