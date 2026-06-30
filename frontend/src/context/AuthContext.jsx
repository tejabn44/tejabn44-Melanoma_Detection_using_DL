import axios from "axios";
import { createContext, useContext, useMemo, useState } from "react";
import {
  API_BASE_URL,
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  CURRENT_HEATMAP_KEY,
  CURRENT_RESULT_KEY,
} from "../utils";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || "");
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem(AUTH_USER_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const persistSession = (nextToken, nextUser) => {
    localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  };

  const clearSession = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(CURRENT_RESULT_KEY);
    localStorage.removeItem(CURRENT_HEATMAP_KEY);
    setToken("");
    setUser(null);
  };

  const login = async ({ email, password }) => {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
    persistSession(response.data.token, response.data.user);
  };

  const signup = async ({ name, email, password }) => {
    const response = await axios.post(`${API_BASE_URL}/auth/signup`, { name, email, password });
    persistSession(response.data.token, response.data.user);
  };

  const logout = async () => {
    if (token) {
      try {
        await axios.post(
          `${API_BASE_URL}/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (error) {
        // Local logout should still succeed even if the backend is unavailable.
      }
    }
    clearSession();
  };

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login,
      signup,
      logout,
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
