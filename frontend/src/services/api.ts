import type { DashboardStats, RecordItem, Resource, User } from "../types";

const baseUrl = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || `Anfrage fehlgeschlagen (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  session: () => request<{ user: User | null }>("/auth/session"),
  dashboard: () => request<{ recentCalls: RecordItem[]; criticalPatients: RecordItem[]; activity: RecordItem[]; notifications: RecordItem[] }>("/dashboard"),
  profile: () => request<{ profile: RecordItem }>("/profile"),
  updateProfile: (values: Record<string, unknown>) => request<{ profile: RecordItem }>("/profile", { method: "PATCH", body: JSON.stringify(values) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  list: async (resource: Resource) => (await request<{ data: RecordItem[] }>(`/${resource}`)).data,
  create: async (resource: Resource, values: Record<string, unknown>) =>
    (await request<{ data: RecordItem }>(`/${resource}`, { method: "POST", body: JSON.stringify(values) })).data,
  update: async (resource: Resource, id: string, values: Record<string, unknown>) =>
    (await request<{ data: RecordItem }>(`/${resource}/${id}`, { method: "PATCH", body: JSON.stringify(values) })).data,
  remove: (resource: Resource, id: string) => request<void>(`/${resource}/${id}`, { method: "DELETE" }),
  stats: () => request<DashboardStats>("/stats")
};

export const loginUrl = `${baseUrl}/auth/discord`;
