const test = require("node:test");
const assert = require("node:assert/strict");
const { provisionInitialAdmin } = require("./bootstrapAdmin");

function setup(existingAdmin = false, used = false) {
  const state = { users: existingAdmin ? [{ role: "Admin" }] : [], markers: used ? [{ _id: "initial-admin" }] : [], ended: false };
  const session = {
    async withTransaction(callback) { return callback(); },
    async endSession() { state.ended = true; }
  };
  const bootstrapRecords = {
    findById() { return { session: async () => state.markers[0] || null }; },
    async create(entries) { state.markers.push(...entries); }
  };
  const users = {
    exists() { return { session: async () => state.users.find((user) => user.role === "Admin") || null }; },
    async create(entries) { state.users.push(...entries); }
  };
  return { state, users, bootstrapRecords, startSession: async () => session };
}

test("first admin bootstrap assigns only server-controlled admin and active values", async () => {
  const fixture = setup();
  await provisionInitialAdmin({ ...fixture, admin: {
    serviceNumber: "PERS-100001",
    displayName: "Test Administrator",
    passwordHash: "$2b$12$hash-only-test-value",
    role: "Benutzer",
    active: false
  } });
  assert.equal(fixture.state.users.length, 1);
  assert.equal(fixture.state.users[0].role, "Admin");
  assert.equal(fixture.state.users[0].active, true);
  assert.equal(fixture.state.users[0].passwordHash, "$2b$12$hash-only-test-value");
  assert.equal(Object.hasOwn(fixture.state.users[0], "password"), false);
  assert.equal(fixture.state.markers.length, 1);
  assert.equal(fixture.state.ended, true);
});

test("bootstrap refuses a second initial admin or a reused setup marker", async () => {
  for (const fixture of [setup(true), setup(false, true)]) {
    await assert.rejects(provisionInitialAdmin({ ...fixture, admin: {
      serviceNumber: "PERS-100002",
      displayName: "Second Administrator",
      passwordHash: "$2b$12$hash-only-test-value"
    } }), /bereits/);
    assert.equal(fixture.state.ended, true);
  }
});

test("bootstrap rejects plaintext or non-bcrypt password values", async () => {
  const fixture = setup();
  await assert.rejects(provisionInitialAdmin({ ...fixture, admin: {
    serviceNumber: "PERS-100003",
    displayName: "Administrator",
    passwordHash: "plaintext-must-never-be-accepted"
  } }), /bcrypt-Hash/);
  assert.equal(fixture.state.ended, false);
});