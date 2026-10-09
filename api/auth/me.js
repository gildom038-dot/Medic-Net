const { auth, log, h } = require('../_lib');
module.exports = h(async (req, res) => {
  const u = auth(req, res); if (!u) return;
  if (req.method === 'POST') await log(u, 'logout'); // Client ruft POST beim Abmelden auf
  res.json({ user: u });
});
