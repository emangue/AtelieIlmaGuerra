"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

const AUTH_TOKEN_KEY = "auth_token";
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export interface User {
  id: number;
  email: string;
  nome: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Erro ao fazer login");
    }
    const data = await res.json();
    if (data.access_token && typeof window !== "undefined") {
      localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
    }
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
      setUser(null);
    }
  };

  const loadUser = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, { credentials: "include" });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        if (typeof window !== "undefined") localStorage.removeItem(AUTH_TOKEN_KEY);
        setUser(null);
      }
    } catch {
      if (typeof window !== "undefined") localStorage.removeItem(AUTH_TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
