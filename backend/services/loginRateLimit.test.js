const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoginRateLimiter, MAX_ATTEMPTS, WINDOW_MS } = require("./loginRateLimit");

test("login limits use a hashed IP key and expire after their window", async () => {
  const records = new Map();
  let expiry;
  const model = {
    async findOneAndUpdate(filter, update, options) {
      let record = records.get(filter._id);
      if (!record && !options.upsert) return null;
      if (!record) {
        record = { _id: filter._id, attempts: 0 };
        records.set(filter._id, record);
        expiry = update.$setOnInsert.expiresAt;
      }
      record.attempts += update.$inc.attempts;
      return { ...record };
    },
    async deleteOne(filter) { records.delete(filter._id); }
  };
  const limiter = createLoginRateLimiter(model);
  const timestamp = 1_700_000_000_000;
  const first = await limiter.consume("192.0.2.1", "test-only-secret", timestamp);
  assert.equal(first.limited, false);
  assert.match(first.key, /^[a-f0-9]{64}$/);
  assert.equal(first.key.includes("192.0.2.1"), false);
  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
    assert.equal((await limiter.consume("192.0.2.1", "test-only-secret", timestamp + attempt)).limited, false);
  }
  assert.equal((await limiter.consume("192.0.2.1", "test-only-secret", timestamp + MAX_ATTEMPTS)).limited, true);
  assert.equal((await limiter.consume("192.0.2.2", "test-only-secret", timestamp)).limited, false);
  assert.equal(expiry.getTime(), Math.floor(timestamp / WINDOW_MS) * WINDOW_MS + 2 * WINDOW_MS);
  await limiter.clear(first.key);
  assert.equal(records.has(first.key), false);
});