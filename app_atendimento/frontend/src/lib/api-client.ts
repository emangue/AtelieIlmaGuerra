/**
 * Cliente HTTP do site de atendimento.
 *
 * Use SEMPRE este módulo — nunca um `fetch` solto com o header montado à mão.
 * É ele que garante o Bearer, o cookie e, principalmente, o logout automático
 * no 401 (sessão expira em 1h). No app de gestão cada tela reimplementou isso e
 * o resultado foram telas que travam sem explicação quando o token vence.
 */

const AUTH_TOKEN_KEY = "atendimento_token";

// Vazio em dev e em produção: o Next faz o proxy de /api, então as chamadas
// são same-origin.
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearAuth(redirect = true): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  document.cookie = `${AUTH_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  if (redirect) window.location.href = "/login";
}

function buildUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE.replace(/\/$/, "")}${cleanPath}` : cleanPath;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });

  // Sessão morreu: limpa e manda para o login em vez de deixar a tela quebrada.
  if (response.status === 401 && !path.includes("/auth/")) {
    clearAuth();
    return new Response(null, { status: 401 });
  }
  return response;
}

async function apiRequest<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Erro desconhecido" }));
    const detail = (err as { detail?: unknown }).detail;
    throw new Error(
      typeof detail === "string" ? detail : `Não foi possível completar a ação (HTTP ${response.status})`
    );
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as unknown as T;
  }
  return response.json();
}

export const api = {
  get: <T = unknown>(path: string, init?: RequestInit) =>
    apiRequest<T>(path, { ...init, method: "GET" }),
  post: <T = unknown>(path: string, data?: unknown, init?: RequestInit) =>
    apiRequest<T>(path, { ...init, method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T = unknown>(path: string, data?: unknown, init?: RequestInit) =>
    apiRequest<T>(path, { ...init, method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: <T = unknown>(path: string, init?: RequestInit) =>
    apiRequest<T>(path, { ...init, method: "DELETE" }),

  /** Upload multipart — sem Content-Type manual, o browser monta o boundary. */
  upload: async <T = unknown>(path: string, file: File): Promise<T> => {
    const form = new FormData();
    form.append("file", file);
    const response = await apiFetch(path, { method: "POST", body: form });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Erro no upload" }));
      throw new Error((err as { detail?: string }).detail || "Não foi possível enviar a foto");
    }
    return response.json();
  },

  fetch: apiFetch,
};

export { AUTH_TOKEN_KEY, buildUrl, clearAuth, getToken, setToken };
