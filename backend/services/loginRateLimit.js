const crypto = require("node:crypto");

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function createLoginRateLimiter(model) {
  async function consume(ipAddress, secret, now = Date.now()) {
    const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
    const key = crypto.createHmac("sha256", secret)
      .update(`${windowStart}:${ipAddress || "unknown"}`)
      .digest("hex");
    const update = {
      $inc: { attempts: 1 },
      $setOnInsert: { expiresAt: new Date(windowStart + 2 * WINDOW_MS) }
    };
    let record;
    try {
      record = await model.findOneAndUpdate(
        { _id: key },
        update,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      record = await model.findOneAndUpdate({ _id: key }, update, { new: true });
    }
    return { key, limited: record.attempts > MAX_ATTEMPTS };
  }

  return {
    consume,
    clear: (key) => model.deleteOne({ _id: key })
  };
}

module.exports = { WINDOW_MS, MAX_ATTEMPTS, createLoginRateLimiter };