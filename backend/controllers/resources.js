const mongoose = require("mongoose");
const { models } = require("../models");
const { recordActivity } = require("../services/audit");
const { classifyVitals } = require("../services/vitals");

const readRoles = {
  users: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr", "Krankenhaus", "Benutzer"], patients: ["Admin", "Moderator", "Krankenhaus", "Rettungsdienst"],
  roles: ["Admin", "Moderator"], patient_records: ["Admin", "Moderator", "Krankenhaus", "Rettungsdienst"],
  vitals: ["Admin", "Moderator", "Krankenhaus", "Rettungsdienst"], beds: ["Admin", "Moderator", "Krankenhaus"],
  calls: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr"], vehicles: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr"],
  radio_channels: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr", "Krankenhaus"],
  radio_messages: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr", "Krankenhaus"],
  invoices: ["Admin", "Moderator", "Krankenhaus"], price_catalog: ["Admin", "Moderator", "Krankenhaus"],
  activity_logs: ["Admin", "Moderator"], notifications: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr", "Krankenhaus", "Benutzer"]
};
const writeRoles = {
  users: ["Admin"], roles: ["Admin"], patients: ["Admin", "Moderator", "Krankenhaus", "Rettungsdienst"],
  patient_records: ["Admin", "Moderator", "Krankenhaus", "Rettungsdienst"],
  vitals: ["Admin", "Moderator", "Krankenhaus", "Rettungsdienst"], beds: ["Admin", "Moderator", "Krankenhaus"],
  calls: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr"], vehicles: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr"],
  radio_channels: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr", "Krankenhaus"],
  radio_messages: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr", "Krankenhaus"],
  invoices: ["Admin", "Moderator", "Krankenhaus"], price_catalog: ["Admin"],
  notifications: ["Admin", "Moderator"]
};

function validateResource(req, res, permission) {
  const resource = req.params.resource;
  if (!Object.hasOwn(models, resource)) {
    res.status(404).json({ error: "Unbekannter Datenbereich." });
    return false;
  }
  if (!permission[resource]?.includes(req.user.role)) {
    res.status(403).json({ error: "Keine Berechtigung für diesen Datenbereich." });
    return false;
  }
  return true;
}

async function list(req, res) {
  if (!validateResource(req, res, readRoles)) return;
  const resource = req.params.resource;
  const rows = await models[resource].find().sort({ createdAt: -1, _id: -1 }).limit(200).lean();
  if (resource === "patients" && rows.length) {
    const ids = rows.map((patient) => patient._id);
    const vitals = await models.vitals.find({ patientId: { $in: ids } }).sort({ recordedAt: -1 }).lean();
    const latest = new Map();
    for (const vital of vitals) {
      const patientId = String(vital.patientId);
      if (!latest.has(patientId)) latest.set(patientId, vital);
    }
    for (const patient of rows) patient.latestVitals = latest.get(String(patient._id)) || null;
  }
  res.json({ data: rows });
}

async function create(req, res) {
  if (req.params.resource === "users") return res.status(403).json({ error: "Benutzer müssen über die geschützte Admin-Benutzerverwaltung angelegt werden." });
  if (!validateResource(req, res, writeRoles)) return;
  const resource = req.params.resource;
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return res.status(400).json({ error: "Ein JSON-Objekt ist erforderlich." });
  const values = { ...req.body };
  if (resource === "patient_records") {
    if (!mongoose.isValidObjectId(values.patientId) || !await models.patients.exists({ _id: values.patientId })) {
      return res.status(400).json({ error: "Ein gültiger Patient muss ausgewählt werden." });
    }
    values.author = req.user.name || req.user.sub;
  }
  if (resource === "vitals") {
    if (!mongoose.isValidObjectId(values.patientId) || !await models.patients.exists({ _id: values.patientId })) {
      return res.status(400).json({ error: "Ein gültiger Patient muss ausgewählt werden." });
    }
    values.classification = classifyVitals(values);
    const patient = await models.patients.findById(values.patientId).select("name").lean();
    values.patientName = patient.name;
  }
  const record = await models[resource].create(values);
  await recordActivity(req.user.name || req.user.sub, "created", resource, record._id);
  if (resource === "vitals") await updatePatientCondition(record, req.user.name || req.user.sub);
  res.status(201).json({ data: record });
}

async function update(req, res) {
  if (req.params.resource === "users") return res.status(403).json({ error: "Benutzeränderungen müssen über die geschützte Admin-Benutzerverwaltung erfolgen." });
  if (!validateResource(req, res, writeRoles)) return;
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Ungültige ID." });
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return res.status(400).json({ error: "Ein JSON-Objekt ist erforderlich." });
  const resource = req.params.resource;
  let update = req.body;
  if (resource === "vitals") {
    const current = await models.vitals.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ error: "Eintrag nicht gefunden." });
    const combined = { ...current, ...req.body };
    if (!mongoose.isValidObjectId(combined.patientId) || !await models.patients.exists({ _id: combined.patientId })) {
      return res.status(400).json({ error: "Ein gültiger Patient muss ausgewählt werden." });
    }
    const patient = await models.patients.findById(combined.patientId).select("name").lean();
    update = { ...req.body, patientId: combined.patientId, patientName: patient.name, classification: classifyVitals(combined) };
  }
  const record = await models[resource].findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!record) return res.status(404).json({ error: "Eintrag nicht gefunden." });
  await recordActivity(req.user.name || req.user.sub, "updated", req.params.resource, record._id);
  if (resource === "vitals") await updatePatientCondition(record, req.user.name || req.user.sub);
  res.json({ data: record });
}

async function updatePatientCondition(vitals, actor) {
  const status = vitals.classification === "Kritisch" ? "Kritisch" : vitals.classification === "Warnung" ? "Beobachtung" : null;
  if (!status) return;
  const patient = await models.patients.findOneAndUpdate(
    { _id: vitals.patientId, status: { $ne: "Entlassen" } },
    { $set: { status } },
    { new: true }
  );
  if (patient) await recordActivity(actor, `Patientenstatus automatisch auf ${status} gesetzt`, "patients", patient._id);
}

async function remove(req, res) {
  if (req.params.resource === "users") return res.status(403).json({ error: "Benutzer müssen deaktiviert statt gelöscht werden." });
  if (!validateResource(req, res, writeRoles)) return;
  if (req.user.role !== "Admin") return res.status(403).json({ error: "Löschen ist Admins vorbehalten." });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Ungültige ID." });
  const record = await models[req.params.resource].findByIdAndDelete(req.params.id);
  if (!record) return res.status(404).json({ error: "Eintrag nicht gefunden." });
  await recordActivity(req.user.name || req.user.sub, "deleted", req.params.resource, record._id);
  res.status(204).end();
}

async function stats(req, res) {
  const permitted = ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr", "Krankenhaus"];
  if (!["Admin", "Moderator", "Rettungsdienst", "Feuerwehr", "Krankenhaus", "Benutzer"].includes(req.user.role)) return res.status(403).json({ error: "Keine Berechtigung." });
  const [calls, patients, beds, vehicles, users, invoices, channels] = await Promise.all([
    models.calls.find().lean(), models.patients.find().lean(), models.beds.find().lean(),
    models.vehicles.find().lean(), models.users.find().lean(), models.invoices.find().lean(),
    models.radio_channels.find({ status: "Aktiv" }).lean()
  ]);
  res.json({
    activeCalls: calls.filter((item) => !["Abgeschlossen", "Abgebrochen"].includes(item.status)).length,
    openCalls: calls.filter((item) => item.status === "Offen").length,
    patients: patients.filter((item) => item.status !== "Entlassen").length,
    criticalPatients: patients.filter((item) => item.status === "Kritisch").length,
    freeBeds: beds.filter((item) => item.status === "Frei").length,
    occupiedBeds: beds.filter((item) => item.status === "Belegt").length,
    activeChannels: channels.length,
    vehiclesOnCall: vehicles.filter((item) => ["Einsatz", "Anfahrt", "Vor Ort", "Transport"].includes(item.status)).length,
    staffOnDuty: users.filter((item) => item.dutyStatus === "Dienst").length,
    openInvoices: invoices.filter((item) => item.status === "Offen").length
  });
}

async function dashboard(req, res) {
  const dispatchRoles = ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr"];
  const recentCalls = dispatchRoles.includes(req.user.role)
    ? await models.calls.find().sort({ createdAt: -1 }).limit(5).lean()
    : [];
  const medicalRoles = ["Admin", "Moderator", "Krankenhaus", "Rettungsdienst"];
  const [criticalPatients, activity, notifications] = await Promise.all([
    medicalRoles.includes(req.user.role)
      ? models.patients.find({ status: "Kritisch" }).sort({ updatedAt: -1 }).limit(5).select("name diagnosis room").lean()
      : Promise.resolve([]),
    ["Admin", "Moderator"].includes(req.user.role)
      ? models.activity_logs.find().sort({ createdAt: -1 }).limit(5).lean()
      : Promise.resolve([]),
    models.notifications.find({ recipientRole: { $in: [null, req.user.role] } }).sort({ createdAt: -1 }).limit(5).lean()
  ]);
  res.json({ recentCalls, criticalPatients, activity, notifications });
}

async function getProfile(req, res) {
  const profile = await models.users.findById(req.user.sub).select("displayName role department dutyStatus discordId lastActivity").lean();
  if (!profile) return res.status(404).json({ error: "Profil nicht gefunden." });
  res.json({ profile });
}

async function updateProfile(req, res) {
  const allowed = ["displayName", "department", "dutyStatus"];
  const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  const profile = await models.users.findByIdAndUpdate(req.user.sub, update, { new: true, runValidators: true })
    .select("displayName role department dutyStatus discordId lastActivity").lean();
  if (!profile) return res.status(404).json({ error: "Profil nicht gefunden." });
  await recordActivity(profile.displayName, "updated profile", "users", profile._id);
  res.json({ profile });
}

module.exports = { list, create, update, remove, stats, dashboard, getProfile, updateProfile };
