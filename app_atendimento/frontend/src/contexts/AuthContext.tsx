"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

import { AUTH_TOKEN_KEY, api, setToken } from "@/lib/api-client";

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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    api
      .get<User>("/api/v1/auth/me")
      .then((u) => ativo && setUser(u))
      .catch(() => {
        if (typeof window !== "undefined") localStorage.removeItem(AUTH_TOKEN_KEY);
        if (ativo) setUser(null);
      })
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ access_token: string; user: User }>(
      "/api/v1/auth/login",
      { email, password }
    );
    if (data.access_token) setToken(data.access_token);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api.post("/api/v1/auth/logout");
    } finally {
      if (typeof window !== "undefined") localStorage.removeItem(AUTH_TOKEN_KEY);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}
