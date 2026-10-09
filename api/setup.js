// Einmalig: POST { key, dienstnummer, name, password } legt den ersten Admin an
const bcrypt = require('bcryptjs');
const { db, log, h } = require('./_lib');
module.exports = h(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST erforderlich' });
  const { key, dienstnummer, name, password } = req.body || {};
  if (!process.env.SETUP_KEY || key !== process.env.SETUP_KEY) return res.status(403).json({ error: 'Falscher Setup-Schlüssel' });
  const U = (await db()).collection('users');
  if (await U.countDocuments()) return res.status(409).json({ error: 'Setup bereits erfolgt' });
  if (!dienstnummer || !password || password.length < 8) return res.status(400).json({ error: 'Dienstnummer und Passwort (min. 8 Zeichen) nötig' });
  await U.createIndex({ dienstnummer: 1 }, { unique: true });
  await U.insertOne({ dienstnummer: String(dienstnummer), name: name || 'Administrator', role: 'admin', gesperrt: false, hash: await bcrypt.hash(password, 10), erstellt: new Date() });
  await log({ dn: dienstnummer }, 'setup', 'Erster Admin angelegt');
  res.json({ ok: true });
});
