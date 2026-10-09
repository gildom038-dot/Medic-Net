const bcrypt = require('bcryptjs');
const { db, auth, log, h, oid } = require('./_lib');
const ROLES = ['admin', 'leitstelle', 'rettungsdienst', 'klinik'];
module.exports = h(async (req, res) => {
  const u = auth(req, res, ['admin']); if (!u) return;
  const C = (await db()).collection('users'), b = req.body || {}, id = oid(req.query.id);
  if (req.method === 'GET') return res.json(await C.find({}, { projection: { hash: 0 } }).sort({ dienstnummer: 1 }).toArray());
  if (req.method === 'POST') {
    if (!b.dienstnummer || !b.password || b.password.length < 8 || !ROLES.includes(b.role)) return res.status(400).json({ error: 'Dienstnummer, Passwort (min. 8) und gültige Rolle nötig' });
    if (await C.findOne({ dienstnummer: String(b.dienstnummer) })) return res.status(409).json({ error: 'Dienstnummer existiert bereits' });
    await C.insertOne({ dienstnummer: String(b.dienstnummer), name: b.name || '', role: b.role, discordId: b.discordId || '', gesperrt: false, hash: await bcrypt.hash(b.password, 10), erstellt: new Date() });
    await log(u, 'benutzer_erstellt', b.dienstnummer); return res.json({ ok: true });
  }
  if (!id) return res.status(400).json({ error: 'ID fehlt' });
  if (req.method === 'PUT') {
    const s = {};
    if (ROLES.includes(b.role)) s.role = b.role;
    if (typeof b.gesperrt === 'boolean') s.gesperrt = b.gesperrt;
    if (b.name !== undefined) s.name = b.name;
    if (b.discordId !== undefined) s.discordId = b.discordId;
    if (b.password) { if (b.password.length < 8) return res.status(400).json({ error: 'Passwort zu kurz' }); s.hash = await bcrypt.hash(b.password, 10); }
    await C.updateOne({ _id: id }, { $set: s }); await log(u, 'benutzer_geaendert', req.query.id + ' ' + Object.keys(s).join(','));
    return res.json({ ok: true });
  }
  if (req.method === 'DELETE') {
    if (String(id) === u.id) return res.status(400).json({ error: 'Eigenes Konto nicht löschbar' });
    await C.deleteOne({ _id: id }); await log(u, 'benutzer_geloescht', req.query.id); return res.json({ ok: true });
  }
  res.status(405).json({ error: 'Methode nicht erlaubt' });
});
