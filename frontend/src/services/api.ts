import type { DashboardStats, RecordItem, Resource, User } from "../types";

const baseUrl = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

function isDemoSession(): boolean {
  try {
    return sessionStorage.getItem("medcnet-demo-session-v1") === "true";
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (isDemoSession()) throw new Error("API-Aufrufe sind im isolierten Demo-Modus deaktiviert.");
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("json")) {
    if (response.status === 404) {
      throw new Error("API-Route nicht gefunden (404). Prüfe die Vercel-API-Routen und das aktuelle Deployment.");
    }
    if (response.ok) {
      throw new Error("Die API hat HTML statt JSON geliefert. Prüfe das Vercel-API-Routing und die Bereitstellung.");
    }
    throw new Error(`API-Fehler (${response.status}): Die Antwort war kein JSON.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Die API hat ungültiges JSON zurückgegeben.");
  }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : `Anfrage fehlgeschlagen (${response.status}).`;
    throw new Error(message);
  }
  return payload as T;
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
