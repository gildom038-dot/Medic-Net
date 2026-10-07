const mongoose = require("mongoose");

let connection;

async function connectDatabase() {
  if (!process.env.MONGODB_URI || !process.env.MONGODB_DATABASE) return false;
  if (mongoose.connection.readyState === 1) return true;
  if (!connection) {
    connection = mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DATABASE || undefined,
      serverSelectionTimeoutMS: 8000
    }).catch((error) => {
      connection = undefined;
      throw error;
    });
  }
  await connection;
  return true;
}

module.exports = { connectDatabase };
