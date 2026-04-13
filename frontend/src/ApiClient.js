import axios from "axios";
import { API } from "./config/config";
import { store } from "./Store/store";
import { startLoading, stopLoading } from "./Store/Slices/loadingSlice";

const ApiClient = axios.create({
    baseURL: API.endsWith('/') ? API.slice(0, -1) : API,
    headers: {
        'Content-Type': 'application/json',
    },
});

ApiClient.interceptors.request.use(
  (config) => {
    // Only show loading if not explicitly disabled
    if (!config.silent) {
      store.dispatch(startLoading());
    }

    const token = localStorage.getItem("token");
    if (token && !config.url.includes('/auth/login')) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    // Note: Request error happens before sending (e.g. invalid config)
    // We don't decrement here because the request hasn't started and startLoading wasn't necessarily called successfully.
    // But if it was, we must decrement.
    return Promise.reject(error);
  }
);

// Response interceptor: auto-logout on token expired / invalid
ApiClient.interceptors.response.use(
  (response) => {
    if (!response.config.silent) {
       store.dispatch(stopLoading());
    }
    return response;
  },
  (error) => {
    if (error.config && !error.config.silent) {
      store.dispatch(stopLoading());
    }

    const status = error.response?.status;
    const message = error.response?.data?.message || '';

    if (status === 401 || (status === 403 && message.toLowerCase().includes('session'))) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("original_token");
      localStorage.removeItem("original_user");
      delete axios.defaults.headers.common['Authorization'];
      window.location.href = '/auth';
    }

    return Promise.reject(error);
  }
);

export default ApiClient;
