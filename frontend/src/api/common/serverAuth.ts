import axios from "axios";
import { CONFIG } from "config";
import { cookies } from "next/headers";
import { clearAuthCookies } from "utils/cookies";

// Create axios instance for server-side requests
const serverAxiosInstance = axios.create({
  baseURL: CONFIG.SERVICE_DESK_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Function to refresh token on the server side
async function refreshServerToken(refreshToken: string) {
  try {
    const response = await axios.post(
      `${CONFIG.SERVICE_DESK_API_URL}/service_desk/refresh`,
      {
        refresh_token: refreshToken,
      }
    );

    if (response.data && response.data.access_token) {
      return response.data;
    }
    throw new Error("Failed to refresh token");
  } catch (error) {
    console.error("Error refreshing token:", error);
    throw error;
  }
}

// Add request interceptor
serverAxiosInstance.interceptors.request.use(
  async (config) => {
    const cookieStore = cookies();
    const accessToken = cookieStore.get("ACCESS_TOKEN")?.value;

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor
serverAxiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const cookieStore = cookies();
        const refreshToken = cookieStore.get("REFRESH_TOKEN")?.value;

        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        // Get new tokens
        const tokens = await refreshServerToken(refreshToken);

        // Update cookies with new tokens
        cookieStore.set("ACCESS_TOKEN", tokens.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
        });

        if (tokens.refresh_token) {
          cookieStore.set("REFRESH_TOKEN", tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
          });
        }

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`;
        return serverAxiosInstance(originalRequest);
      } catch (refreshError) {
        // If refresh fails, clear cookies and return error
        clearAuthCookies();
        throw refreshError;
      }
    }
    return Promise.reject(error);
  }
);

export { serverAxiosInstance };
