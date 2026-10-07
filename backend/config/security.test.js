const test = require("node:test");
const assert = require("node:assert/strict");
const { getJwtSecret } = require("./security");

test("JWT_SECRET must be present, sufficiently long, and not a placeholder", () => {
  const original = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET;
    assert.throws(() => getJwtSecret(), /JWT_SECRET/);
    process.env.JWT_SECRET = "replace-this-with-a-long-random-secret";
    assert.throws(() => getJwtSecret(), /JWT_SECRET/);
    process.env.JWT_SECRET = "short";
    assert.throws(() => getJwtSecret(), /JWT_SECRET/);
    process.env.JWT_SECRET = "a".repeat(48);
    assert.equal(getJwtSecret(), "a".repeat(48));
  } finally {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  }
});
