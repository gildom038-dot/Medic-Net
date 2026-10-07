const mongoose = require("mongoose");

const schemas = {
  users: { displayName: String, discordId: { type: String, unique: true, sparse: true }, serviceNumber: String, role: { type: String, enum: ["Admin", "Moderator", "Rettungsdienst", "Krankenhaus", "Feuerwehr", "Benutzer"], default: "Benutzer" }, department: String, dutyStatus: { type: String, enum: ["Dienst", "Pause", "Außer Dienst"], default: "Außer Dienst" }, lastActivity: Date, banned: { type: Boolean, default: false } },
  patients: { name: { type: String, required: true }, age: { type: Number, min: 0, max: 130 }, status: { type: String, enum: ["Aufgenommen", "Beobachtung", "Kritisch", "Entlassen"], default: "Aufgenommen" }, diagnosis: String, allergies: [String], bloodType: String, room: String, bed: String, admittedAt: Date, dischargedAt: Date, notes: String },
  vitals: { patientId: { type: mongoose.Schema.Types.ObjectId, required: true }, patientName: String, pulse: { type: Number, min: 0, max: 300, required: true }, respiratoryRate: { type: Number, min: 0, max: 100, required: true }, temperature: { type: Number, min: 25, max: 45, required: true }, oxygenSaturation: { type: Number, min: 0, max: 100, required: true }, bloodPressure: { type: String, required: true }, notes: String, classification: { type: String, enum: ["Normal", "Warnung", "Kritisch"], required: true }, recordedAt: { type: Date, default: Date.now } },
  beds: { code: { type: String, required: true }, ward: String, status: { type: String, enum: ["Frei", "Belegt", "Reserviert", "Wartung"], default: "Frei" }, patientId: mongoose.Schema.Types.ObjectId },
  calls: { title: { type: String, required: true }, incidentType: String, address: String, status: { type: String, enum: ["Offen", "Angenommen", "Anfahrt", "Vor Ort", "Transport", "Abgeschlossen", "Abgebrochen"], default: "Offen" }, priority: { type: String, enum: ["P1", "P2", "P3"], default: "P3" }, patientCount: { type: Number, min: 0 }, team: [String], vehicles: [String], notes: String, history: [mongoose.Schema.Types.Mixed], createdBy: String },
  vehicles: { callSign: { type: String, required: true }, kind: String, location: String, status: { type: String, enum: ["Frei", "Einsatz", "Anfahrt", "Vor Ort", "Transport", "Außer Dienst", "Werkstatt"], default: "Frei" }, crew: [String], fuel: { type: Number, min: 0, max: 100 }, mileage: { type: Number, min: 0 }, radioCallSign: String },
  radio_channels: { name: { type: String, required: true }, description: String, status: { type: String, default: "Aktiv" }, participants: [String] },
  radio_messages: { channelId: String, channelName: String, sender: String, body: { type: String, required: true }, createdAt: { type: Date, default: Date.now } },
  invoices: { invoiceNumber: String, patientId: String, patientName: String, callId: String, services: [mongoose.Schema.Types.Mixed], amountCents: Number, status: { type: String, enum: ["Offen", "Bezahlt", "Storniert"], default: "Offen" }, createdAt: { type: Date, default: Date.now } },
  price_catalog: { name: { type: String, required: true }, amountCents: { type: Number, min: 0, required: true }, active: { type: Boolean, default: true } },
  activity_logs: { actor: String, action: String, entity: String, entityId: String, createdAt: { type: Date, default: Date.now } }
};

const models = Object.fromEntries(Object.entries(schemas).map(([name, definition]) => [
  name,
  mongoose.models[name] || mongoose.model(name, new mongoose.Schema(definition, { collection: name, timestamps: true, strict: true }))
]));

module.exports = { models };
