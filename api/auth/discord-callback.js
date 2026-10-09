// Discord-ID muss im Benutzerkonto hinterlegt sein (Admin trägt sie ein) – keine automatische Registrierung
const { db, sign, log, h } = require('../_lib');
module.exports = h(async (req, res) => {
  const code = req.query.code; if (!code) return res.redirect('/?error=discord');
  const t = await (await fetch('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: process.env.DISCORD_REDIRECT_URI }) })).json();
  if (!t.access_token) return res.redirect('/?error=discord');
  const d = await (await fetch('https://discord.com/api/users/@me', { headers: { Authorization: 'Bearer ' + t.access_token } })).json();
  const u = await (await db()).collection('users').findOne({ discordId: d.id });
  if (!u || u.gesperrt) { await log({ dn: 'discord:' + d.id }, 'discord_login_abgelehnt'); return res.redirect('/?error=kein_konto'); }
  await log(u, 'login_discord');
  res.redirect('/?token=' + encodeURIComponent(sign(u)));
});
