import axios from "axios";

// Production Render backend API URL
const BASE_URL = "https://attendance-system-g9hk.onrender.com/api/v1";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

let userToken: string | null = null;
let refreshTokenValue: string | null = null;

export const setAuthToken = (token: string | null) => {
  userToken = token;
};

export const setRefreshTokenValue = (token: string | null) => {
  refreshTokenValue = token;
};

interface AuthCallbacks {
  // Called after a silent refresh succeeds, so the caller can persist the
  // rotated tokens (the backend revokes the old refresh token on every use).
  onTokensUpdated?: (accessToken: string, refreshToken: string) => void;
  // Called when the refresh token itself is invalid/expired — the only
  // point where the app should actually force the user back to the login
  // screen (normal 30-minute access-token expiry is handled silently).
  onAuthExpired?: () => void;
}

let authCallbacks: AuthCallbacks = {};

export const registerAuthCallbacks = (callbacks: AuthCallbacks) => {
  authCallbacks = callbacks;
};

apiClient.interceptors.request.use((config) => {
  if (userToken) {
    config.headers.Authorization = `Bearer ${userToken}`;
  }
  return config;
});

// Access tokens expire after 30 minutes (see backend ACCESS_TOKEN_EXPIRE_MINUTES).
// Without this, every request made after 30 minutes idle would 401 and (before
// this fix) there was nothing to catch that — the app just looked broken.
// Refresh tokens live 30 days and rotate on every use, so multiple 401s firing
// at once (e.g. right after the app resumes from background) must share a
// single in-flight refresh — reusing an already-rotated-out refresh token
// would fail.
let refreshPromise: Promise<{ access_token: string; refresh_token: string }> | null = null;

function performRefresh(): Promise<{ access_token: string; refresh_token: string }> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshTokenValue })
      .then(({ data }) => {
        const tokens = data?.data ?? data;
        setAuthToken(tokens.access_token);
        setRefreshTokenValue(tokens.refresh_token);
        authCallbacks.onTokensUpdated?.(tokens.access_token, tokens.refresh_token);
        return tokens;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => {
    if (response.data && "data" in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const original = error.config;
    const url: string = original?.url ?? "";
    const isAuthEndpoint = url.includes("/auth/refresh") || url.includes("/auth/login");

    if (error.response?.status === 401 && original && !original._retry && refreshTokenValue && !isAuthEndpoint) {
      original._retry = true;
      try {
        const { access_token } = await performRefresh();
        original.headers = { ...original.headers, Authorization: `Bearer ${access_token}` };
        return apiClient(original);
      } catch {
        authCallbacks.onAuthExpired?.();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
