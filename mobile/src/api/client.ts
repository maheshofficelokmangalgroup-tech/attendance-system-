import axios from "axios";

// Production Render backend API URL
const BASE_URL = "https://attendance-system-g9hk.onrender.com/api/v1";


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
