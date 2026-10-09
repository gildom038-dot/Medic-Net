const jwt = require("jsonwebtoken");
const { models } = require("../models");
const { getJwtSecret } = require("../config/security");
const { connectDatabase } = require("../config/database");

const roleAliases = {
  Admin: ["Admin", "Administrator"],
  Moderator: ["Admin", "Moderator"],
  Rettungsdienst: ["Admin", "Moderator", "Rettungsdienst"],
  Krankenhaus: ["Admin", "Moderator", "Krankenhaus"],
  Feuerwehr: ["Admin", "Moderator", "Feuerwehr"],
  Benutzer: ["Admin", "Moderator", "Benutzer"]
};

async function authenticate(req, res, next) {
  const token = req.cookies?.medcnet_session;
  if (!token) return res.status(401).json({ error: "Anmeldung erforderlich." });
  let secret;
  try {
    secret = getJwtSecret();
  } catch {
    return res.status(503).json({ error: "JWT_SECRET ist nicht korrekt konfiguriert." });
  }
  let claims;
  try {
    claims = jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch {
    res.clearCookie("medcnet_session", { path: "/" });
    return res.status(401).json({ error: "Sitzung abgelaufen. Bitte erneut anmelden." });
  }
  try {
    const connected = await connectDatabase();
    if (!connected) return res.status(503).json({ error: "MongoDB Atlas ist nicht konfiguriert. Prüfe MONGODB_URI und MONGODB_DATABASE." });
    req.user = claims;
    const profile = await models.users.findById(req.user.sub).select("role banned").lean();
    if (!profile || profile.banned) return res.status(403).json({ error: "Dieses Konto ist gesperrt oder nicht verfügbar." });
    req.user.role = profile.role;
    next();
  } catch {
    return res.status(503).json({ error: "MongoDB Atlas ist derzeit nicht verfügbar." });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!roleAliases[role]?.includes(req.user.role)) return res.status(403).json({ error: "Keine Berechtigung für diese Aktion." });
    next();
  };
}

module.exports = { authenticate, requireRole };
