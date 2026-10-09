const { db, auth, h } = require('./_lib');
module.exports = h(async (req, res) => {
  if (!auth(req, res, ['admin'])) return;
  res.json(await (await db()).collection('logs').find().sort({ zeit: -1 }).limit(300).toArray());
});
