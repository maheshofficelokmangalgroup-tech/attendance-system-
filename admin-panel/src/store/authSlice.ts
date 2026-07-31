import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface UserInfo {
  id: number;
  email: string;
  role: string;
  role_name: string;
  employee_id: number | null;
  full_name: string | null;
}

interface AuthState {
  access_token: string | null;
  refresh_token: string | null;
  user: UserInfo | null;
  is_authenticated: boolean;
}

const STORAGE_KEY = "attendance_auth";

function loadFromStorage(): Partial<AuthState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    access_token: state.access_token,
    refresh_token: state.refresh_token,
    user: state.user,
    is_authenticated: state.is_authenticated,
  }));
}

const persisted = loadFromStorage();

const initialState: AuthState = {
  access_token: persisted.access_token ?? null,
  refresh_token: persisted.refresh_token ?? null,
  user: persisted.user ?? null,
  is_authenticated: persisted.is_authenticated ?? false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<{ access_token: string; refresh_token: string; user: UserInfo }>) {
      state.access_token = action.payload.access_token;
      state.refresh_token = action.payload.refresh_token;
      state.user = action.payload.user;
      state.is_authenticated = true;
      saveToStorage(state as AuthState);
    },
    setTokens(state, action: PayloadAction<{ access_token: string; refresh_token: string }>) {
      state.access_token = action.payload.access_token;
      state.refresh_token = action.payload.refresh_token;
      saveToStorage(state as AuthState);
    },
    clearAuth(state) {
      state.access_token = null;
      state.refresh_token = null;
      state.user = null;
      state.is_authenticated = false;
      localStorage.removeItem(STORAGE_KEY);
    },
  },
});

export const { setAuth, setTokens, clearAuth } = authSlice.actions;
export default authSlice.reducer;
