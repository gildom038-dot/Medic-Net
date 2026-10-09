const mongoose = require("mongoose");

let connection;

function missingDatabaseConfiguration() {
  return ["MONGODB_URI", "MONGODB_DATABASE"].filter((name) => !process.env[name]?.trim());
}

function databaseFailureReason(error) {
  const clues = [
    error?.name,
    error?.code,
    error?.cause?.name,
    error?.cause?.code,
    error?.message,
    error?.cause?.message
  ].filter(Boolean).join(" ").toLowerCase();

  if (/auth|bad credentials|authentication failed/.test(clues) || error?.code === 18) return "authentication_failed";
  if (/enotfound|eai_again|dns/.test(clues)) return "dns_lookup_failed";
  if (/econnrefused|econnreset/.test(clues)) return "connection_refused";
  if (/timeout|timed out|etimedout/.test(clues)) return "connection_timed_out";
  if (/mongoparseerror|invalid scheme|invalid connection string/.test(clues)) return "invalid_connection_uri";
  return "connection_failed";
}

async function connectDatabase() {
  const missing = missingDatabaseConfiguration();
  if (missing.length) return false;
  if (mongoose.connection.readyState === 1) return true;
  if (mongoose.connection.readyState === 0) connection = undefined;
  if (!connection) {
    connection = mongoose.connect(process.env.MONGODB_URI.trim(), {
      dbName: process.env.MONGODB_DATABASE.trim(),
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000
    }).catch((error) => {
      connection = undefined;
      throw error;
    });
  }
  await connection;
  if (mongoose.connection.readyState !== 1) {
    connection = undefined;
    throw new Error("MongoDB connection did not become ready.");
  }
  return true;
}

module.exports = { connectDatabase, missingDatabaseConfiguration, databaseFailureReason };
