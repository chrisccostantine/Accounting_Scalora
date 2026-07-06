import axios from 'axios';

const runtimeApiUrl = window.__SCALORA_ENV__?.VITE_API_URL;

function normalizeApiUrl(url: string) {
  const cleanUrl = url.replace(/\/$/, '');
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown[];
}

export const api = axios.create({
  baseURL: normalizeApiUrl(runtimeApiUrl || import.meta.env.VITE_API_URL || 'http://localhost:4000/api')
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('scalora_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) localStorage.removeItem('scalora_token');
    return Promise.reject(error);
  }
);
