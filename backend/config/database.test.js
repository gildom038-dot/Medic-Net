const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { connectDatabase, databaseFailureReason, missingDatabaseConfiguration } = require("./database");

test("missing MongoDB configuration names only the required environment variables", () => {
  const originalUri = process.env.MONGODB_URI;
  const originalDatabase = process.env.MONGODB_DATABASE;
  try {
    delete process.env.MONGODB_URI;
    process.env.MONGODB_DATABASE = " ";
    assert.deepEqual(missingDatabaseConfiguration(), ["MONGODB_URI", "MONGODB_DATABASE"]);
    process.env.MONGODB_URI = "configured-uri";
    process.env.MONGODB_DATABASE = "medcnet_test";
    assert.deepEqual(missingDatabaseConfiguration(), []);
  } finally {
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
    if (originalDatabase === undefined) delete process.env.MONGODB_DATABASE;
    else process.env.MONGODB_DATABASE = originalDatabase;
  }
});

test("MongoDB failure diagnostics are safe categories and never echo URI details", () => {
  const error = new Error("Authentication failed for mongodb://user:secret@host/db");
  error.name = "MongoServerError";
  error.code = 18;
  const reason = databaseFailureReason(error);
  assert.equal(reason, "authentication_failed");
  assert.equal(reason.includes("secret"), false);
  assert.equal(databaseFailureReason(Object.assign(new Error("ETIMEDOUT"), { code: "ETIMEDOUT" })), "connection_timed_out");
  assert.equal(databaseFailureReason(new Error("No network details")), "connection_failed");
});

test("MongoDB connection is reused while ready and retried after disconnect", async () => {
  const originalUri = process.env.MONGODB_URI;
  const originalDatabase = process.env.MONGODB_DATABASE;
  const originalConnect = mongoose.connect;
  const originalReadyState = mongoose.connection.readyState;
  let connectionAttempts = 0;
  let connectionOptions;

  try {
    process.env.MONGODB_URI = "test-uri-without-credentials";
    process.env.MONGODB_DATABASE = "medcnet_test";
    mongoose.connection.readyState = 0;
    mongoose.connect = async (_uri, options) => {
      connectionAttempts += 1;
      connectionOptions = options;
      mongoose.connection.readyState = 1;
      return mongoose;
    };

    assert.equal(await connectDatabase(), true);
    assert.equal(await connectDatabase(), true);
    assert.equal(connectionAttempts, 1);
    assert.equal(connectionOptions.maxPoolSize, 10);

    mongoose.connection.readyState = 0;
    assert.equal(await connectDatabase(), true);
    assert.equal(connectionAttempts, 2);
  } finally {
    mongoose.connect = originalConnect;
    mongoose.connection.readyState = originalReadyState;
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
    if (originalDatabase === undefined) delete process.env.MONGODB_DATABASE;
    else process.env.MONGODB_DATABASE = originalDatabase;
  }
});