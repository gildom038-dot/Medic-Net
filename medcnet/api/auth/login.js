const bcrypt = require('bcryptjs');
const { db, sign, log, h } = require('../_lib');
module.exports = h(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST erforderlich' });
  const { dienstnummer, password } = req.body || {};
  const u = await (await db()).collection('users').findOne({ dienstnummer: String(dienstnummer || '') });
  if (!u || u.gesperrt || !(await bcrypt.compare(String(password || ''), u.hash))) {
    await log({ dn: dienstnummer }, 'login_fehlgeschlagen');
    return res.status(401).json({ error: 'Dienstnummer oder Passwort falsch (oder Konto gesperrt)' });
  }
  await log(u, 'login');
  res.json({ token: sign(u), user: { dienstnummer: u.dienstnummer, name: u.name, role: u.role } });
});
