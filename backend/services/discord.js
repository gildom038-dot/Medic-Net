const crypto = require("node:crypto");

function makeState() {
  return crypto.randomBytes(24).toString("hex");
}

function validState(expected, received) {
  if (!expected || !received || expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

async function discordToken(code) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI
  });
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error("Discord OAuth token exchange failed.");
  return response.json();
}

async function getDiscordIdentity(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const [userResponse, memberResponse] = await Promise.all([
    fetch("https://discord.com/api/users/@me", { headers, signal: AbortSignal.timeout(10_000) }),
    process.env.DISCORD_GUILD_ID
      ? fetch(`https://discord.com/api/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`, { headers, signal: AbortSignal.timeout(10_000) })
      : Promise.resolve(null)
  ]);
  if (!userResponse.ok) throw new Error("Discord identity request failed.");
  const user = await userResponse.json();
  const member = memberResponse?.ok ? await memberResponse.json() : null;
  if (process.env.DISCORD_GUILD_ID && !member) throw new Error("Discord account is not a member of the configured server.");
  const roleIds = member?.roles || [];
  if (process.env.MEMBER_ROLE_ID && !roleIds.includes(process.env.MEMBER_ROLE_ID)
    && ![process.env.ADMIN_ROLE_ID, process.env.MODERATOR_ROLE_ID, process.env.FIRE_ROLE_ID, process.env.POLICE_ROLE_ID].filter(Boolean).some((id) => roleIds.includes(id))) {
    throw new Error("Discord account does not have an authorized MEDCNET role.");
  }
  const role = roleIds.includes(process.env.ADMIN_ROLE_ID) ? "Admin"
    : roleIds.includes(process.env.MODERATOR_ROLE_ID) ? "Moderator"
      : roleIds.includes(process.env.FIRE_ROLE_ID) ? "Feuerwehr"
        : roleIds.includes(process.env.POLICE_ROLE_ID) ? "Rettungsdienst" : "Benutzer";
  return { user, role };
}

module.exports = { makeState, validState, discordToken, getDiscordIdentity };
