const { db, auth, log, h, oid, list } = require('./_lib');
const STATUS = ['verfügbar', 'im Einsatz', 'außer Dienst', 'Werkstatt'];
module.exports = h(async (req, res) => {
  const u = auth(req, res); if (!u) return;
  const C = (await db()).collection('vehicles'), b = req.body || {}, id = oid(req.query.id);
  if (req.method === 'GET') return res.json(await C.find().sort({ kennung: 1 }).toArray());
  if (!['admin', 'leitstelle'].includes(u.role)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const f = {};
  if (b.kennung) f.kennung = String(b.kennung);
  if (b.standort !== undefined) f.standort = b.standort;
  if (STATUS.includes(b.status)) f.status = b.status;
  if (b.tank !== undefined && b.tank !== '') f.tank = Math.min(100, Math.max(0, Number(b.tank) || 0));
  if (b.funkkanal !== undefined) f.funkkanal = b.funkkanal;
  if (b.funkstatus !== undefined) f.funkstatus = b.funkstatus;
  if (b.besatzung !== undefined) f.besatzung = list(b.besatzung);
  if (b.wartung !== undefined) f.wartung = b.wartung;
  if (req.method === 'POST') {
    if (!f.kennung) return res.status(400).json({ error: 'Kennung fehlt' });
    await C.insertOne({ status: 'verfügbar', tank: 100, besatzung: [], ...f, erstellt: new Date() });
    await log(u, 'fahrzeug_erstellt', f.kennung); return res.json({ ok: true });
  }
  if (!id) return res.status(400).json({ error: 'ID fehlt' });
  if (req.method === 'PUT') { await C.updateOne({ _id: id }, { $set: f }); await log(u, 'fahrzeug_geaendert', req.query.id + ' ' + JSON.stringify(f)); return res.json({ ok: true }); }
  if (req.method === 'DELETE') { await C.deleteOne({ _id: id }); await log(u, 'fahrzeug_geloescht', req.query.id); return res.json({ ok: true }); }
  res.status(405).json({ error: 'Methode nicht erlaubt' });
});
