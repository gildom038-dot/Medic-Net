const jwt = require("jsonwebtoken");
const { models } = require("../models");
const { getJwtSecret } = require("../config/security");

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
  let claims;
  try {
    claims = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
  } catch {
    res.clearCookie("medcnet_session");
    return res.status(401).json({ error: "Sitzung abgelaufen. Bitte erneut anmelden." });
  }
  try {
    req.user = claims;
    const profile = await models.users.findById(req.user.sub).select("role banned").lean();
    if (!profile || profile.banned) return res.status(403).json({ error: "Dieses Konto ist gesperrt oder nicht verfügbar." });
    req.user.role = profile.role;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!roleAliases[role]?.includes(req.user.role)) return res.status(403).json({ error: "Keine Berechtigung für diese Aktion." });
    next();
  };
}

module.exports = { authenticate, requireRole };
