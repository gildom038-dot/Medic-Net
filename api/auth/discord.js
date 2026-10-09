module.exports = (req, res) => {
  const p = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, redirect_uri: process.env.DISCORD_REDIRECT_URI, response_type: 'code', scope: 'identify' });
  res.redirect('https://discord.com/oauth2/authorize?' + p);
};
