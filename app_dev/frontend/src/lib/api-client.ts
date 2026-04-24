/**
 * Cliente API com autenticação e tratamento 401
 *
 * - Usa credentials: "include" para enviar cookie auth_token
 * - Redireciona para /auth/login em caso de 401
 * - Suporta token em localStorage (fallback para requests diretos)
 */

const API_BASE = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_BACKEND_URL || "")
  : "";

function getBaseUrl(): string {
  if (typeof window === "undefined") return API_BASE || "";
  return API_BASE || "";
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("auth_token");
  document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  window.location.href = "/auth/login";
}

function buildUrl(path: string): string {
  const base = getBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base.replace(/\/$/, "")}${cleanPath}` : cleanPath;
}

async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = buildUrl(path);
  const headers = new Headers(init?.headers);

  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    clearAuth();
    return new Response(null, { status: 401 });
  }

  return response;
}

async function apiRequest<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Erro desconhecido" }));
    throw new Error((err as { detail?: string }).detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: <T = unknown>(path: string, init?: RequestInit) =>
    apiRequest<T>(path, { ...init, method: "GET" }),

  post: <T = unknown>(path: string, data?: unknown, init?: RequestInit) =>
    apiRequest<T>(path, {
      ...init,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = unknown>(path: string, data?: unknown, init?: RequestInit) =>
    apiRequest<T>(path, {
      ...init,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T = unknown>(path: string, data?: unknown, init?: RequestInit) =>
    apiRequest<T>(path, {
      ...init,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = unknown>(path: string, init?: RequestInit) =>
    apiRequest<T>(path, { ...init, method: "DELETE" }),

  fetch: apiFetch,
};

export { buildUrl, getToken, clearAuth };
