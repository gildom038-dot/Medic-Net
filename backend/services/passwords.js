const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 72;
let dummyHashPromise;

function normalizeServiceNumber(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{1,39}$/.test(normalized) ? normalized : null;
}

function passwordError(value) {
  if (typeof value !== "string") return "Das Passwort muss als Text angegeben werden.";
  if (value.length < MIN_PASSWORD_LENGTH) return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`;
  if (Buffer.byteLength(value, "utf8") > MAX_PASSWORD_BYTES) return "Das Passwort darf höchstens 72 UTF-8-Bytes lang sein.";
  return null;
}

async function hashPassword(password) {
  const error = passwordError(password);
  if (error) throw new Error(error);
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, hash) {
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) return false;
  try {
    if (typeof hash !== "string") {
      dummyHashPromise ||= bcrypt.hash(crypto.randomBytes(32).toString("base64url"), BCRYPT_ROUNDS);
      await bcrypt.compare(password, await dummyHashPromise);
      return false;
    }
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

module.exports = { BCRYPT_ROUNDS, MIN_PASSWORD_LENGTH, MAX_PASSWORD_BYTES, normalizeServiceNumber, passwordError, hashPassword, verifyPassword };