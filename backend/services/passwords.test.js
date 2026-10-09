const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { hashPassword, normalizeServiceNumber, passwordError, verifyPassword } = require("./passwords");

test("service numbers normalize and reject malformed input", () => {
  assert.equal(normalizeServiceNumber(" pers-001 "), "PERS-001");
  assert.equal(normalizeServiceNumber("!admin"), null);
  assert.equal(normalizeServiceNumber(undefined), null);
});

test("passwords are stored as bcrypt hashes and verified without revealing values", async () => {
  const password = crypto.randomBytes(18).toString("base64url");
  const hash = await hashPassword(password);
  assert.match(hash, /^\$2[aby]\$12\$/);
  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(`${password}x`, hash), false);
  assert.equal(await verifyPassword(password, undefined), false);
});

test("password policy enforces minimum length and bcrypt UTF-8 byte limit", async () => {
  assert.match(passwordError("short"), /mindestens 12/);
  assert.match(passwordError("ä".repeat(37)), /72 UTF-8-Bytes/);
  assert.equal(passwordError("long-enough-test-passphrase"), null);
  await assert.rejects(hashPassword("short"), /mindestens 12/);
});