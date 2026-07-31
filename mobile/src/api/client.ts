import axios from "axios";

// A physical phone running this in Expo Go can't reach "localhost" or the
// Android-emulator-only "10.0.2.2" alias — it needs the dev machine's actual
// LAN IP, and both devices must be on the same Wi-Fi network.
const BASE_URL = "http://192.168.0.102:8000/api/v1";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

let userToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  userToken = token;
};

apiClient.interceptors.request.use((config) => {
  if (userToken) {
    config.headers.Authorization = `Bearer ${userToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (response.data && "data" in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export default apiClient;
