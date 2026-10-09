const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const readline = require("node:readline");
const mongoose = require("mongoose");
const { models } = require("../models");
const { connectDatabase } = require("../config/database");
const { getJwtSecret } = require("../config/security");
const { normalizeServiceNumber, passwordError, hashPassword } = require("../services/passwords");

function makeBootstrapError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function provisionInitialAdmin({ users, bootstrapRecords, startSession, admin }) {
  if (!/^\$2[aby]\$12\$/.test(admin.passwordHash || "")) {
    throw makeBootstrapError("INVALID_PASSWORD_HASH", "Für den Admin muss ein bcrypt-Hash mit Kostenfaktor 12 vorliegen.");
  }
  const session = await startSession();
  try {
    await session.withTransaction(async () => {
      const marker = await bootstrapRecords.findById("initial-admin").session(session);
      if (marker) throw makeBootstrapError("BOOTSTRAP_ALREADY_USED", "Die Admin-Ersteinrichtung wurde bereits verwendet.");

      const existingAdmin = await users.exists({ role: "Admin" }).session(session);
      if (existingAdmin) throw makeBootstrapError("ADMIN_ALREADY_EXISTS", "Ein Administrator ist bereits vorhanden.");

      await bootstrapRecords.create([{ _id: "initial-admin", createdAt: new Date() }], { session });
      await users.create([{
        serviceNumber: admin.serviceNumber,
        displayName: admin.displayName,
        passwordHash: admin.passwordHash,
        role: "Admin",
        active: true,
        banned: false,
        dutyStatus: "Außer Dienst"
      }], { session });
    });
  } finally {
    await session.endSession();
  }
}

function askText(question) {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  return terminal.question(question).finally(() => terminal.close());
}

function askHidden(question) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(makeBootstrapError("INTERACTIVE_TERMINAL_REQUIRED", "Für die Passworteingabe ist ein interaktives Terminal erforderlich."));
  }

  readline.emitKeypressEvents(input);
  const wasRaw = Boolean(input.isRaw);
  input.setRawMode(true);
  input.resume();
  process.stdout.write(question);

  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      input.removeListener("keypress", onKeypress);
      input.setRawMode(wasRaw);
      process.stdout.write("\n");
    };
    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(makeBootstrapError("SETUP_CANCELLED", "Einrichtung abgebrochen."));
      } else if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(value);
      } else if (key.name === "backspace") {
        value = Array.from(value).slice(0, -1).join("");
      } else if (character && !key.ctrl && !key.meta) {
        value += character;
      }
    };
    input.on("keypress", onKeypress);
  });
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw makeBootstrapError("INTERACTIVE_TERMINAL_REQUIRED", "Admin-Setup muss lokal in einem interaktiven Terminal ausgeführt werden.");
  getJwtSecret();
  if (!await connectDatabase()) throw makeBootstrapError("DATABASE_CONFIGURATION_MISSING", "MONGODB_URI und MONGODB_DATABASE müssen lokal gesetzt sein.");

  const existingAdmin = await models.users.exists({ role: "Admin" });
  const used = await models.auth_bootstrap.exists({ _id: "initial-admin" });
  if (existingAdmin || used) throw makeBootstrapError("BOOTSTRAP_ALREADY_USED", "Ein Administrator existiert bereits oder die Einmal-Einrichtung wurde verwendet.");

  await models.auth_bootstrap.createCollection().catch((error) => {
    if (error.code !== 48) throw error;
  });
  await models.users.collection.createIndex({ serviceNumber: 1 }, { unique: true, sparse: true });

  const serviceNumber = normalizeServiceNumber(await askText("Dienstnummer: "));
  if (!serviceNumber) throw makeBootstrapError("INVALID_SERVICE_NUMBER", "Die Dienstnummer ist ungültig.");
  const displayName = (await askText("Anzeigename: ")).trim();
  if (!displayName || displayName.length > 80) throw makeBootstrapError("INVALID_DISPLAY_NAME", "Der Anzeigename ist ungültig.");

  const password = await askHidden("Starkes Passwort (mindestens 12 Zeichen): ");
  const confirmation = await askHidden("Passwort wiederholen: ");
  if (password !== confirmation) throw makeBootstrapError("PASSWORD_MISMATCH", "Die Passwörter stimmen nicht überein.");
  const invalidPassword = passwordError(password);
  if (invalidPassword) throw makeBootstrapError("INVALID_PASSWORD", invalidPassword);

  const passwordHash = await hashPassword(password);
  await provisionInitialAdmin({
    users: models.users,
    bootstrapRecords: models.auth_bootstrap,
    startSession: () => mongoose.startSession(),
    admin: { serviceNumber, displayName, passwordHash }
  });
  console.info("Administrator wurde eingerichtet. Das Passwort wurde nicht gespeichert oder ausgegeben.");
}

if (require.main === module) {
  main().catch((error) => {
    if (error.code && error.code.startsWith("BOOTSTRAP_")) console.error(error.message);
    else if (["INTERACTIVE_TERMINAL_REQUIRED", "DATABASE_CONFIGURATION_MISSING", "INVALID_SERVICE_NUMBER", "INVALID_DISPLAY_NAME", "INVALID_PASSWORD", "INVALID_PASSWORD_HASH", "PASSWORD_MISMATCH", "SETUP_CANCELLED"].includes(error.code)) console.error(error.message);
    else console.error("Admin-Setup fehlgeschlagen. Prüfe die lokale Datenbankkonfiguration und den MongoDB-Status.");
    process.exitCode = 1;
  }).finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
}

module.exports = { provisionInitialAdmin };