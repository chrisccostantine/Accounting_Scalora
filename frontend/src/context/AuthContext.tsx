import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, type ApiResponse } from '../services/api';

interface AuthContextValue {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem('scalora_token'));
  const value = useMemo<AuthContextValue>(() => ({
    token,
    async login(email, password) {
      const response = await api.post<ApiResponse<{ token: string }>>('/auth/login', { email, password });
      localStorage.setItem('scalora_token', response.data.data.token);
      setToken(response.data.data.token);
    },
    logout() {
      localStorage.removeItem('scalora_token');
      setToken(null);
    }
  }), [token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
