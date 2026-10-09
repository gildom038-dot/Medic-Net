const { db, auth, log, h, oid, list } = require('./_lib');
const STATUS = ['offen', 'zugewiesen', 'in Bearbeitung', 'abgeschlossen'];
async function nummer(d, name, prefix) { // fortlaufend, atomar
  const y = new Date().getFullYear();
  const c = await d.collection('counters').findOneAndUpdate({ _id: name + y }, { $inc: { n: 1 } }, { upsert: true, returnDocument: 'after' });
  return `${prefix}-${y}-${String(c.n).padStart(6, '0')}`;
}
module.exports = h(async (req, res) => {
  const u = auth(req, res); if (!u) return;
  const d = await db(), C = d.collection('incidents'), b = req.body || {}, id = oid(req.query.id);
  if (req.method === 'GET') return res.json(await C.find().sort({ erstellt: -1 }).limit(300).toArray());
  if (!['admin', 'leitstelle', 'rettungsdienst'].includes(u.role)) return res.status(403).json({ error: 'Keine Berechtigung' });
  if (req.method === 'POST') {
    if (!b.stichwort) return res.status(400).json({ error: 'Einsatzstichwort fehlt' });
    const nr = await nummer(d, 'einsatz', 'E');
    const fz = list(b.fahrzeuge);
    await C.insertOne({ einsatznummer: nr, stichwort: b.stichwort, adresse: b.adresse || '', beschreibung: b.beschreibung || '', fahrzeuge: fz, status: fz.length ? 'zugewiesen' : 'offen', erstellt: new Date(), erstelltVon: u.dn });
    if (fz.length) await d.collection('vehicles').updateMany({ kennung: { $in: fz } }, { $set: { status: 'im Einsatz' } });
    await log(u, 'einsatz_erstellt', nr); return res.json({ ok: true, einsatznummer: nr });
  }
  if (!id) return res.status(400).json({ error: 'ID fehlt' });
  if (req.method === 'PUT') {
    const s = {};
    if (STATUS.includes(b.status)) s.status = b.status;
    if (b.fahrzeuge !== undefined) s.fahrzeuge = list(b.fahrzeuge);
    if (b.beschreibung !== undefined) s.beschreibung = b.beschreibung;
    await C.updateOne({ _id: id }, { $set: s });
    const e = await C.findOne({ _id: id });
    if (s.status === 'abgeschlossen' && e) await d.collection('vehicles').updateMany({ kennung: { $in: e.fahrzeuge || [] } }, { $set: { status: 'verfügbar' } });
    await log(u, 'einsatz_geaendert', (e?.einsatznummer || req.query.id) + ' ' + Object.keys(s).join(',')); return res.json({ ok: true });
  }
  if (req.method === 'DELETE') { if (u.role !== 'admin') return res.status(403).json({ error: 'Nur Admin' }); await C.deleteOne({ _id: id }); await log(u, 'einsatz_geloescht', req.query.id); return res.json({ ok: true }); }
  res.status(405).json({ error: 'Methode nicht erlaubt' });
});
