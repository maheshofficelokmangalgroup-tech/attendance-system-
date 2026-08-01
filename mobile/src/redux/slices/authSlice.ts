import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { setAuthToken, setRefreshTokenValue } from "../../api/client";

interface UserProfile {
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
  user: UserProfile | null;
  is_authenticated: boolean;
}

const initialState: AuthState = {
  access_token: null,
  refresh_token: null,
  user: null,
  is_authenticated: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth(
      state,
      action: PayloadAction<{
        access_token: string;
        refresh_token: string;
        user: UserProfile;
      }>
    ) {
      state.access_token = action.payload.access_token;
      state.refresh_token = action.payload.refresh_token;
      state.user = action.payload.user;
      state.is_authenticated = true;
      setAuthToken(action.payload.access_token);
      setRefreshTokenValue(action.payload.refresh_token);
    },
    // Fired after a silent background token refresh — updates the tokens
    // only, leaving `user` untouched (see api/client.ts performRefresh()).
    updateTokens(state, action: PayloadAction<{ access_token: string; refresh_token: string }>) {
      state.access_token = action.payload.access_token;
      state.refresh_token = action.payload.refresh_token;
      setAuthToken(action.payload.access_token);
      setRefreshTokenValue(action.payload.refresh_token);
    },
    clearAuth(state) {
      state.access_token = null;
      state.refresh_token = null;
      state.user = null;
      state.is_authenticated = false;
      setAuthToken(null);
      setRefreshTokenValue(null);
    },
  },
});

export const { setAuth, updateTokens, clearAuth } = authSlice.actions;
export default authSlice.reducer;
