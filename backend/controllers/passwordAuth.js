const jwt = require("jsonwebtoken");
const { models } = require("../models");
const { connectDatabase, databaseFailureReason } = require("../config/database");
const { getJwtSecret } = require("../config/security");
const { normalizeServiceNumber, verifyPassword } = require("../services/passwords");
const { createLoginRateLimiter } = require("../services/loginRateLimit");
const { recordActivity } = require("../services/audit");

const loginRateLimiter = createLoginRateLimiter(models.login_attempts);

function createLoginController(dependencies = {}) {
  const users = dependencies.users || models.users;
  const connect = dependencies.connectDatabase || connectDatabase;
  const getSecret = dependencies.getJwtSecret || getJwtSecret;
  const limiter = dependencies.loginRateLimiter || loginRateLimiter;
  const verify = dependencies.verifyPassword || verifyPassword;
  const audit = dependencies.recordActivity || recordActivity;
  const logger = dependencies.logger || console;
  const sign = dependencies.signToken || ((claims, secret) => jwt.sign(claims, secret, { expiresIn: "8h" }));

  return async function login(req, res) {
    const serviceNumber = normalizeServiceNumber(req.body?.serviceNumber);
    const password = req.body?.password;
    if (!serviceNumber || typeof password !== "string" || password.length === 0 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ error: "Dienstnummer und Passwort sind erforderlich." });
    }

    let secret;
    try {
      secret = getSecret();
    } catch {
      return res.status(503).json({ error: "Die Anmeldung ist serverseitig nicht korrekt konfiguriert." });
    }

    try {
      const connected = await connect();
      if (!connected) return res.status(503).json({ error: "MongoDB Atlas ist nicht konfiguriert. Prüfe MONGODB_URI und MONGODB_DATABASE." });
    } catch (error) {
      logger.error(`Password login database connection failed: ${databaseFailureReason(error)}.`);
      return res.status(503).json({ error: "Die Anmeldung ist momentan nicht verfügbar." });
    }

    let attempt;
    try {
      attempt = await limiter.consume(req.ip || req.socket?.remoteAddress, secret);
    } catch {
      logger.error("Password login rate limiter unavailable.");
      return res.status(503).json({ error: "Die Anmeldung ist momentan nicht verfügbar." });
    }
    if (attempt.limited) return res.status(429).json({ error: "Zu viele Anmeldeversuche. Bitte später erneut versuchen." });

    let user;
    let passwordMatches = false;
    try {
      user = await users.findOne({ serviceNumber }).select("+passwordHash").lean();
      passwordMatches = await verify(password, user?.passwordHash);
    } catch (error) {
      logger.error(`Password login verification failed: ${databaseFailureReason(error)}.`);
      return res.status(503).json({ error: "Die Anmeldung ist momentan nicht verfügbar." });
    }

    if (!user || !passwordMatches || user.active === false || user.banned) {
      logger.warn("Password login failed.");
      return res.status(401).json({ error: "Dienstnummer oder Passwort ist ungültig." });
    }

    await Promise.allSettled([
      users.updateOne({ _id: user._id }, { $set: { lastActivity: new Date() } }),
      limiter.clear(attempt.key),
      audit(user.displayName || serviceNumber, "signed in", "users", user._id)
    ]);
    logger.info("Password login succeeded.");

    const token = sign({
      sub: String(user._id),
      name: user.displayName,
      role: user.role,
      serviceNumber: user.serviceNumber,
      authVersion: user.authVersion || 0
    }, secret);
    res.cookie("medcnet_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000
    });
    return res.json({
      user: {
        sub: String(user._id),
        name: user.displayName,
        role: user.role,
        serviceNumber: user.serviceNumber
      }
    });
  };
}

const login = createLoginController();

module.exports = { createLoginController, login };