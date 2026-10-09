const { db, h } = require('./_lib');
module.exports = h(async (req, res) => { await (await db()).command({ ping: 1 }); res.json({ ok: true, database: 'verbunden' }); });
