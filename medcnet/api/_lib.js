const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
let cli;
async function db() {
  if (!cli) cli = new MongoClient(process.env.MONGODB_URI).connect();
  return (await cli).db(process.env.DB_NAME || 'medcnet');
}
function auth(req, res, roles) {
  try {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    const u = jwt.verify(t, process.env.JWT_SECRET);
    if (roles && !roles.includes(u.role)) { res.status(403).json({ error: 'Keine Berechtigung' }); return null; }
    return u;
  } catch { res.status(401).json({ error: 'Nicht angemeldet' }); return null; }
}
const sign = u => jwt.sign({ id: String(u._id), dn: u.dienstnummer, name: u.name, role: u.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
async function log(u, aktion, detail = '') {
  const d = await db();
  await d.collection('logs').insertOne({ zeit: new Date(), dienstnummer: u?.dn || u?.dienstnummer || '-', aktion, detail });
}
const h = fn => async (req, res) => { try { await fn(req, res); } catch (e) { console.error(e); res.status(500).json({ error: 'Serverfehler' }); } };
const oid = s => { try { return new ObjectId(s); } catch { return null; } };
const list = v => Array.isArray(v) ? v : String(v || '').split(',').map(s => s.trim()).filter(Boolean);
module.exports = { db, auth, sign, log, h, oid, list };
