const jwt = require("jsonwebtoken");
const { models } = require("../models");
const { makeState, validState, discordToken, getDiscordIdentity } = require("../services/discord");
const { getJwtSecret } = require("../config/security");
const { connectDatabase } = require("../config/database");

function cookieOptions(req) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 * 1000 };
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || "").replace(/\/$/, "");
}

function validDiscordRedirectUri() {
  try {
    const redirect = new URL(process.env.DISCORD_REDIRECT_URI);
    const frontend = new URL(frontendUrl());
    const localHttp = process.env.NODE_ENV !== "production"
      && redirect.protocol === "http:"
      && ["localhost", "127.0.0.1"].includes(redirect.hostname);
    return redirect.pathname === "/api/auth/callback"
      && redirect.origin === frontend.origin
      && (redirect.protocol === "https:" || localHttp)
      && !redirect.search
      && !redirect.hash;
  } catch {
    return false;
  }
}

function authStartFailure(req, res, code, message) {
  if ((req.get("accept") || "").toLowerCase().includes("application/json")) {
    return res.status(503).json({ error: message });
  }
  return res.redirect(`${frontendUrl()}/?authError=${code}`);
}

function signSession(user) {
  return jwt.sign({ sub: String(user._id), name: user.displayName, role: user.role, discordId: user.discordId }, getJwtSecret(), { expiresIn: "8h" });
}

async function startDiscord(req, res) {
  if (!process.env.MONGODB_URI || !process.env.MONGODB_DATABASE) {
    return authStartFailure(req, res, "databaseConfig", "MongoDB Atlas ist nicht konfiguriert. Prüfe MONGODB_URI und MONGODB_DATABASE.");
  }
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_REDIRECT_URI || !process.env.DISCORD_GUILD_ID || !frontendUrl()) {
    return authStartFailure(req, res, "oauthConfig", "Discord OAuth ist unvollständig konfiguriert. Prüfe DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, DISCORD_GUILD_ID und FRONTEND_URL.");
  }
  if (!validDiscordRedirectUri()) {
    return authStartFailure(req, res, "oauthConfig", "DISCORD_REDIRECT_URI muss HTTPS verwenden und exakt auf /api/auth/callback derselben FRONTEND_URL zeigen.");
  }
  try { getJwtSecret(); }
  catch { return authStartFailure(req, res, "sessionConfig", "JWT_SECRET fehlt, ist zu kurz oder ungültig."); }
  const state = makeState();
  res.cookie("medcnet_oauth_state", state, { ...cookieOptions(req), maxAge: 10 * 60 * 1000 });
  const scope = encodeURIComponent("identify guilds.members.read");
  res.redirect(`https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(process.env.DISCORD_CLIENT_ID)}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=${scope}&state=${state}`);
}

async function finishDiscord(req, res) {
  const { code, state, error } = req.query;
  const expected = req.cookies?.medcnet_oauth_state;
  res.clearCookie("medcnet_oauth_state", { path: "/" });
  if (error || typeof code !== "string" || typeof state !== "string" || !validState(expected, state)) {
    return res.redirect(`${frontendUrl()}/?authError=discord`);
  }
  try {
    const token = await discordToken(code);
    const { user, role } = await getDiscordIdentity(token.access_token);
    let connected;
    try {
      connected = await connectDatabase();
    } catch (err) {
      console.error("Discord database connection failed:", err.name || "Error");
      return res.redirect(`${frontendUrl()}/?authError=databaseUnavailable`);
    }
    if (!connected) return res.redirect(`${frontendUrl()}/?authError=databaseConfig`);
    let profile;
    try {
      profile = await models.users.findOneAndUpdate(
        { discordId: user.id },
        { $set: { displayName: user.global_name || user.username, role, department: "", lastActivity: new Date() }, $setOnInsert: { dutyStatus: "Außer Dienst" } },
        { upsert: true, new: true, runValidators: true }
      );
    } catch (err) {
      console.error("Discord profile persistence failed:", err.name || "Error");
      return res.redirect(`${frontendUrl()}/?authError=databaseUnavailable`);
    }
    if (profile.banned) return res.redirect(`${frontendUrl()}/?authError=blocked`);
    res.cookie("medcnet_session", signSession(profile), cookieOptions(req));
    res.redirect(`${frontendUrl()}/`);
  } catch (err) {
    console.error("Discord sign-in failed:", err.name || "Error");
    if (!process.env.MONGODB_URI || !process.env.MONGODB_DATABASE) {
      return res.redirect(`${frontendUrl()}/?authError=databaseConfig`);
    }
    res.redirect(`${frontendUrl()}/?authError=discord`);
  }
}

async function currentUser(req, res) {
  res.json({ user: req.user });
}

async function session(req, res) {
  const token = req.cookies?.medcnet_session;
  if (!token) return res.json({ user: null });
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
    return res.json({ user: null });
  }
  try {
    const connected = await connectDatabase();
    if (!connected) return res.status(503).json({ error: "MongoDB Atlas ist nicht konfiguriert. Prüfe MONGODB_URI und MONGODB_DATABASE." });
  } catch {
    return res.status(503).json({ error: "MongoDB Atlas ist derzeit nicht verfügbar." });
  }
  let profile;
  try {
    profile = await models.users.findById(claims.sub).select("displayName role discordId banned").lean();
  } catch {
    return res.status(503).json({ error: "MongoDB Atlas ist derzeit nicht verfügbar." });
  }
  if (!profile || profile.banned) {
    res.clearCookie("medcnet_session", { path: "/" });
    return res.json({ user: null });
  }
  res.json({ user: { sub: String(profile._id), name: profile.displayName, role: profile.role, discordId: profile.discordId } });
}

function logout(req, res) {
  res.clearCookie("medcnet_session", { path: "/" });
  res.status(204).end();
}

module.exports = { startDiscord, finishDiscord, currentUser, session, logout, validDiscordRedirectUri };
