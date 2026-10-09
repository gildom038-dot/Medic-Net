const mongoose = require("mongoose");
const { models } = require("../models");
const { connectDatabase } = require("../config/database");
const { normalizeServiceNumber, passwordError, hashPassword } = require("../services/passwords");
const { recordActivity } = require("../services/audit");

const roles = ["Admin", "Moderator", "Rettungsdienst", "Krankenhaus", "Feuerwehr", "Benutzer"];

function createUserAdminController(dependencies = {}) {
  const users = dependencies.users || models.users;
  const connect = dependencies.connectDatabase || connectDatabase;
  const hash = dependencies.hashPassword || hashPassword;
  const audit = dependencies.recordActivity || recordActivity;
  const validId = dependencies.isValidObjectId || mongoose.isValidObjectId;

  async function ensureDatabase(res) {
    try {
      if (await connect()) return true;
      res.status(503).json({ error: "MongoDB Atlas ist nicht konfiguriert." });
    } catch {
      res.status(503).json({ error: "MongoDB Atlas ist derzeit nicht verfügbar." });
    }
    return false;
  }

  async function createUser(req, res) {
    const body = req.body;
    const serviceNumber = normalizeServiceNumber(body?.serviceNumber);
    const passwordProblem = passwordError(body?.password);
    if (!serviceNumber || passwordProblem || typeof body?.displayName !== "string" || !body.displayName.trim() || body.displayName.trim().length > 80) {
      return res.status(400).json({ error: passwordProblem || "Dienstnummer und Anzeigename sind ungültig." });
    }
    const role = body.role || "Benutzer";
    if (!roles.includes(role)) return res.status(400).json({ error: "Die angegebene Rolle ist ungültig." });
    if (!await ensureDatabase(res)) return undefined;

    try {
      const passwordHash = await hash(body.password);
      const user = await users.create({
        serviceNumber,
        displayName: body.displayName.trim(),
        passwordHash,
        role,
        active: true,
        department: typeof body.department === "string" ? body.department.trim().slice(0, 80) : "",
        dutyStatus: "Außer Dienst"
      });
      await audit(req.user.name || req.user.sub, "created user", "users", user._id);
      return res.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ error: "Diese Dienstnummer ist bereits vergeben." });
      return res.status(503).json({ error: "Benutzer konnte nicht angelegt werden." });
    }
  }

  async function updateUser(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ error: "Ungültige Benutzer-ID." });
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ error: "Ein JSON-Objekt ist erforderlich." });

    const update = {};
    if (Object.hasOwn(body, "displayName")) {
      if (typeof body.displayName !== "string" || !body.displayName.trim() || body.displayName.trim().length > 80) return res.status(400).json({ error: "Der Anzeigename ist ungültig." });
      update.displayName = body.displayName.trim();
    }
    if (Object.hasOwn(body, "serviceNumber")) {
      const serviceNumber = normalizeServiceNumber(body.serviceNumber);
      if (!serviceNumber) return res.status(400).json({ error: "Die Dienstnummer ist ungültig." });
      update.serviceNumber = serviceNumber;
    }
    if (Object.hasOwn(body, "role")) {
      if (!roles.includes(body.role)) return res.status(400).json({ error: "Die angegebene Rolle ist ungültig." });
      update.role = body.role;
    }
    if (Object.hasOwn(body, "active")) {
      if (typeof body.active !== "boolean") return res.status(400).json({ error: "Der Aktivstatus muss boolesch sein." });
      update.active = body.active;
    }
    for (const key of ["department", "dutyStatus"]) {
      if (Object.hasOwn(body, key)) {
        if (typeof body[key] !== "string" || body[key].length > 80) return res.status(400).json({ error: `${key} ist ungültig.` });
        update[key] = body[key].trim();
      }
    }
    if (!Object.keys(update).length) return res.status(400).json({ error: "Keine unterstützten Benutzeränderungen angegeben." });
    if (!await ensureDatabase(res)) return undefined;

    try {
      if ((update.role && update.role !== "Admin") || update.active === false) {
        const target = await users.findById(req.params.id).select("role active").lean();
        if (!target) return res.status(404).json({ error: "Benutzer nicht gefunden." });
        if (target.role === "Admin" && target.active !== false) {
          const otherAdmins = await users.countDocuments({
            _id: { $ne: target._id },
            role: "Admin",
            active: { $ne: false },
            banned: { $ne: true }
          });
          if (otherAdmins === 0) return res.status(409).json({ error: "Der letzte aktive Administrator kann nicht deaktiviert oder herabgestuft werden." });
        }
      }

      const user = await users.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
        .select("serviceNumber displayName role active department dutyStatus banned").lean();
      if (!user) return res.status(404).json({ error: "Benutzer nicht gefunden." });
      await audit(req.user.name || req.user.sub, "updated user", "users", user._id);
      return res.json({ user: publicUser(user) });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ error: "Diese Dienstnummer ist bereits vergeben." });
      return res.status(503).json({ error: "Benutzer konnte nicht aktualisiert werden." });
    }
  }

  async function resetPassword(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ error: "Ungültige Benutzer-ID." });
    const passwordProblem = passwordError(req.body?.password);
    if (passwordProblem) return res.status(400).json({ error: passwordProblem });
    if (!await ensureDatabase(res)) return undefined;
    try {
      const passwordHash = await hash(req.body.password);
      const result = await users.updateOne({ _id: req.params.id }, { $set: { passwordHash }, $inc: { authVersion: 1 } });
      if (!result.matchedCount) return res.status(404).json({ error: "Benutzer nicht gefunden." });
      await audit(req.user.name || req.user.sub, "reset user password", "users", req.params.id);
      return res.status(204).end();
    } catch {
      return res.status(503).json({ error: "Passwort konnte nicht zurückgesetzt werden." });
    }
  }

  return { createUser, updateUser, resetPassword };
}

function publicUser(user) {
  return {
    _id: String(user._id),
    serviceNumber: user.serviceNumber,
    displayName: user.displayName,
    role: user.role,
    active: user.active !== false,
    department: user.department || "",
    dutyStatus: user.dutyStatus || "Außer Dienst",
    banned: Boolean(user.banned)
  };
}

module.exports = { createUserAdminController, publicUser };