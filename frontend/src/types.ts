export type Resource =
  | "calls"
  | "patients"
  | "vitals"
  | "beds"
  | "vehicles"
  | "users"
  | "roles"
  | "patient_records"
  | "radio_channels"
  | "radio_messages"
  | "invoices"
  | "price_catalog"
  | "activity_logs"
  | "notifications";

export type RecordItem = Record<string, unknown> & { _id: string };

export type User = {
  sub: string;
  name: string;
  role: string;
  serviceNumber?: string;
  discordId?: string;
};

export type DashboardStats = {
  activeCalls: number;
  openCalls: number;
  patients: number;
  criticalPatients: number;
  freeBeds: number;
  occupiedBeds: number;
  activeChannels: number;
  vehiclesOnCall: number;
  staffOnDuty: number;
  openInvoices: number;
};
