const jwt = require("jsonwebtoken");
const { models } = require("../models");
const { makeState, validState, discordToken, getDiscordIdentity } = require("../services/discord");
const { getJwtSecret } = require("../config/security");

function cookieOptions(req) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 * 1000 };
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || "").replace(/\/$/, "");
}

function signSession(user) {
  return jwt.sign({ sub: String(user._id), name: user.displayName, role: user.role, discordId: user.discordId }, getJwtSecret(), { expiresIn: "8h" });
}

async function startDiscord(req, res) {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_REDIRECT_URI || !process.env.DISCORD_GUILD_ID || !frontendUrl()) {
    return res.redirect(`${frontendUrl()}/?authError=oauthConfig`);
  }
  try { getJwtSecret(); }
  catch { return res.redirect(`${frontendUrl()}/?authError=sessionConfig`); }
  const state = makeState();
  res.cookie("medcnet_oauth_state", state, { ...cookieOptions(req), maxAge: 10 * 60 * 1000 });
  const scope = encodeURIComponent("identify guilds.members.read");
  res.redirect(`https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(process.env.DISCORD_CLIENT_ID)}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=${scope}&state=${state}`);
}

async function finishDiscord(req, res) {
  const { code, state, error } = req.query;
  const expected = req.cookies?.medcnet_oauth_state;
  res.clearCookie("medcnet_oauth_state", { path: "/" });
  if (error || !validState(expected, state)) return res.redirect(`${frontendUrl()}/?authError=discord`);
  try {
    const token = await discordToken(code);
    const { user, role } = await getDiscordIdentity(token.access_token);
    const profile = await models.users.findOneAndUpdate(
      { discordId: user.id },
      { $set: { displayName: user.global_name || user.username, role, department: "", lastActivity: new Date() }, $setOnInsert: { dutyStatus: "Außer Dienst" } },
      { upsert: true, new: true, runValidators: true }
    );
    if (profile.banned) return res.redirect(`${frontendUrl()}/?authError=blocked`);
    res.cookie("medcnet_session", signSession(profile), cookieOptions(req));
    res.redirect(`${frontendUrl()}/`);
  } catch (err) {
    console.error("Discord sign-in failed:", err.message);
    res.redirect(`${frontendUrl()}/?authError=discord`);
  }
}

async function currentUser(req, res) {
  res.json({ user: req.user });
}

async function session(req, res) {
  const token = req.cookies?.medcnet_session;
  if (!token) return res.json({ user: null });
  const secret = getJwtSecret();
  let claims;
  try {
    claims = jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch {
    res.clearCookie("medcnet_session", { path: "/" });
    return res.json({ user: null });
  }
  const profile = await models.users.findById(claims.sub).select("displayName role discordId banned").lean();
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

module.exports = { startDiscord, finishDiscord, currentUser, session, logout };
