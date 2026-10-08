import type { DashboardStats, RecordItem, Resource, User } from "../types";

const dataKey = "medcnet-demo-data-v1";
export const demoSessionKey = "medcnet-demo-session-v1";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const initialData: Record<Resource, RecordItem[]> = {
  users: [
    { _id: "demo-user-1", displayName: "Alex Beispiel", serviceNumber: "RD-104", role: "Admin", department: "Leitstelle", dutyStatus: "Dienst", lastActivity: minutesAgo(5), banned: false },
    { _id: "demo-user-2", displayName: "Sam Muster", serviceNumber: "KH-208", role: "Krankenhaus", department: "Notaufnahme", dutyStatus: "Dienst", lastActivity: minutesAgo(18), banned: false }
  ],
  roles: [
    { _id: "demo-role-1", name: "Rettungsdienst", description: "Fiktive Demo-Rolle", permissions: ["calls:read", "patients:read"] },
    { _id: "demo-role-2", name: "Krankenhaus", description: "Fiktive Demo-Rolle", permissions: ["patients:read", "beds:write"] }
  ],
  patients: [
    { _id: "demo-patient-1", name: "Mara Beispiel", age: 42, status: "Kritisch", diagnosis: "Beispiel: Kreislaufbeschwerden", allergies: ["Keine bekannt"], bloodType: "A+", room: "204", bed: "B-204-01", admittedAt: minutesAgo(75), latestVitals: { pulse: 124, oxygenSaturation: 91, classification: "Kritisch" } },
    { _id: "demo-patient-2", name: "Robin Muster", age: 31, status: "Aufgenommen", diagnosis: "Beispiel: Frakturverdacht", allergies: [], bloodType: "0+", room: "110", bed: "B-110-02", admittedAt: minutesAgo(35) }
  ],
  patient_records: [
    { _id: "demo-record-1", patientId: "demo-patient-1", patientName: "Mara Beispiel", title: "Aufnahme", diagnosis: "Beispiel: Kreislaufbeschwerden", notes: "Fiktiver Demo-Akteneintrag", author: "Demo-Leitstelle", recordedAt: minutesAgo(72), createdAt: minutesAgo(72) }
  ],
  vitals: [
    { _id: "demo-vitals-1", patientId: "demo-patient-1", patientName: "Mara Beispiel", pulse: 124, respiratoryRate: 25, temperature: 38.2, oxygenSaturation: 91, bloodPressure: "96/64", classification: "Kritisch", notes: "Fiktiver Demo-Datensatz", recordedAt: minutesAgo(8) }
  ],
  beds: [
    { _id: "demo-bed-1", code: "B-204-01", ward: "Innere Medizin", status: "Belegt", patientId: "demo-patient-1" },
    { _id: "demo-bed-2", code: "B-110-02", ward: "Chirurgie", status: "Belegt", patientId: "demo-patient-2" },
    { _id: "demo-bed-3", code: "B-110-03", ward: "Chirurgie", status: "Frei" },
    { _id: "demo-bed-4", code: "B-110-04", ward: "Chirurgie", status: "Reserviert" },
    { _id: "demo-bed-5", code: "B-204-05", ward: "Innere Medizin", status: "Wartung" }
  ],
  calls: [
    { _id: "demo-call-1", title: "Verkehrsunfall", incidentType: "Verkehrsunfall", address: "Musterstraße 12", status: "Anfahrt", priority: "P1", patientCount: 2, team: ["Alex Beispiel"], vehicles: ["RTW 01"], notes: "Fiktiver Demo-Einsatz", history: [{ status: "Anfahrt", at: minutesAgo(12), actor: "Demo-Leitstelle" }], createdAt: minutesAgo(12) },
    { _id: "demo-call-2", title: "Medizinischer Notfall", incidentType: "Notfall", address: "Beispielweg 8", status: "Offen", priority: "P2", patientCount: 1, team: [], vehicles: [], notes: "Fiktiver Demo-Einsatz", history: [], createdAt: minutesAgo(28) }
  ],
  vehicles: [
    { _id: "demo-vehicle-1", callSign: "RTW 01", kind: "Rettungswagen", location: "Innenstadt", status: "Einsatz", crew: ["Alex Beispiel", "Sam Muster"], fuel: 78, mileage: 42150 },
    { _id: "demo-vehicle-2", callSign: "NEF 02", kind: "Notarzteinsatzfahrzeug", location: "Wache Nord", status: "Frei", crew: ["Taylor Demo"], fuel: 92, mileage: 28900 }
  ],
  radio_channels: [
    { _id: "demo-channel-1", name: "Leitstelle", description: "Fiktiver Demo-Kanal", status: "Aktiv", participants: ["Alex Beispiel"] },
    { _id: "demo-channel-2", name: "Rettungsdienst", description: "Fiktiver Demo-Kanal", status: "Aktiv", participants: ["Sam Muster"] }
  ],
  radio_messages: [
    { _id: "demo-message-1", channelId: "demo-channel-1", channelName: "Leitstelle", sender: "Alex Beispiel", body: "Demo-Nachricht: RTW 01 ist auf Anfahrt.", createdAt: minutesAgo(10) }
  ],
  invoices: [
    { _id: "demo-invoice-1", invoiceNumber: "DEMO-0001", patientName: "Mara Beispiel", patientId: "demo-patient-1", callId: "demo-call-1", services: [{ name: "Demo-Leistung", amountCents: 12500 }], amountCents: 12500, status: "Offen", createdAt: minutesAgo(20) }
  ],
  price_catalog: [
    { _id: "demo-price-1", name: "Demo-Leistung", amountCents: 12500, active: true }
  ],
  activity_logs: [
    { _id: "demo-log-1", actor: "Demo-Leitstelle", action: "Fiktiver Beispieldatensatz geladen", entity: "system", createdAt: minutesAgo(2) }
  ],
  notifications: [
    { _id: "demo-notification-1", title: "Demo-Einsatz P1", message: "RTW 01 ist bei einem fiktiven Einsatz auf Anfahrt.", type: "Warnung", read: false, createdAt: minutesAgo(6) }
  ]
};

export const demoUser: User = {
  sub: "demo-user",
  name: "Demo-Leitstelle",
  role: "Admin",
  discordId: "DEMO"
};

function readData(): Record<Resource, RecordItem[]> {
  const raw = localStorage.getItem(dataKey);
  if (!raw) return structuredClone(initialData);
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) throw new Error("Demo-Datenspeicher ist beschädigt. Bitte Demo-Daten zurücksetzen.");
  return { ...structuredClone(initialData), ...(parsed as Partial<Record<Resource, RecordItem[]>>) };
}

function writeData(data: Record<Resource, RecordItem[]>): void {
  localStorage.setItem(dataKey, JSON.stringify(data));
}

export function demoList(resource: Resource): RecordItem[] {
  return [...(readData()[resource] || [])].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export function demoSave(resource: Resource, values: Record<string, unknown>, id?: string): RecordItem {
  const data = readData();
  const rows = data[resource] || [];
  const existing = id ? rows.find((row) => row._id === id) : undefined;
  const record = {
    ...existing,
    ...values,
    _id: id || `demo-${resource}-${crypto.randomUUID()}`,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as RecordItem;
  data[resource] = existing ? rows.map((row) => row._id === id ? record : row) : [record, ...rows];
  data.activity_logs = [{
    _id: `demo-log-${crypto.randomUUID()}`,
    actor: demoUser.name,
    action: existing ? "Demo-Eintrag geändert" : "Demo-Eintrag erstellt",
    entity: resource,
    createdAt: new Date().toISOString()
  }, ...data.activity_logs];
  writeData(data);
  return record;
}

export function demoRemove(resource: Resource, id: string): void {
  const data = readData();
  data[resource] = data[resource].filter((row) => row._id !== id);
  data.activity_logs = [{
    _id: `demo-log-${crypto.randomUUID()}`,
    actor: demoUser.name,
    action: "Demo-Eintrag gelöscht",
    entity: resource,
    createdAt: new Date().toISOString()
  }, ...data.activity_logs];
  writeData(data);
}

export function demoStats(): DashboardStats {
  const data = readData();
  const activeCalls = data.calls.filter((row) => !["Abgeschlossen", "Abgebrochen"].includes(String(row.status))).length;
  return {
    activeCalls,
    openCalls: data.calls.filter((row) => row.status === "Offen").length,
    patients: data.patients.filter((row) => row.status !== "Entlassen").length,
    criticalPatients: data.patients.filter((row) => row.status === "Kritisch").length,
    freeBeds: data.beds.filter((row) => row.status === "Frei").length,
    occupiedBeds: data.beds.filter((row) => row.status === "Belegt").length,
    activeChannels: data.radio_channels.filter((row) => row.status === "Aktiv").length,
    vehiclesOnCall: data.vehicles.filter((row) => ["Einsatz", "Anfahrt", "Vor Ort", "Transport"].includes(String(row.status))).length,
    staffOnDuty: data.users.filter((row) => row.dutyStatus === "Dienst").length,
    openInvoices: data.invoices.filter((row) => row.status === "Offen").length
  };
}

export function demoReset(): void {
  localStorage.removeItem(dataKey);
  localStorage.removeItem("medcnet-demo-profile-v1");
}
