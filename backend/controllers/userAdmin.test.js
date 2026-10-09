const test = require("node:test");
const assert = require("node:assert/strict");
const { createUserAdminController } = require("./userAdmin");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(status) { this.statusCode = status; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
}

test("admin user creation hashes passwords and fixes active status server-side", async () => {
  let created;
  const audit = [];
  const controller = createUserAdminController({
    users: { create: async (value) => { created = value; return { ...value, _id: "created-user" }; } },
    connectDatabase: async () => true,
    hashPassword: async () => "$2b$12$test-hash-only",
    recordActivity: async (...args) => audit.push(args)
  });
  const result = response();
  await controller.createUser({
    user: { sub: "admin-id", role: "Admin" },
    body: { serviceNumber: " pers-1001 ", displayName: "Staff Member", password: "test-only-password-123", role: "Benutzer", active: false, passwordHash: "injected" }
  }, result);

  assert.equal(result.statusCode, 201);
  assert.equal(created.serviceNumber, "PERS-1001");
  assert.equal(created.role, "Benutzer");
  assert.equal(created.active, true);
  assert.equal(created.passwordHash, "$2b$12$test-hash-only");
  assert.equal(Object.hasOwn(created, "password"), false);
  assert.equal(Object.hasOwn(result.body.user, "passwordHash"), false);
  assert.equal(Object.hasOwn(result.body.user, "password"), false);
  assert.equal(audit.length, 1);
});

test("admin user creation rejects invalid roles, duplicate numbers and weak passwords", async () => {
  let hashCalls = 0;
  const controller = createUserAdminController({
    users: { create: async () => { const error = new Error("duplicate"); error.code = 11000; throw error; } },
    connectDatabase: async () => true,
    hashPassword: async () => { hashCalls += 1; return "$2b$12$test"; },
    recordActivity: async () => {}
  });
  const base = { serviceNumber: "PERS-1002", displayName: "Staff Member", password: "strong-enough-test-password" };

  const invalidRole = response();
  await controller.createUser({ body: { ...base, role: "Superuser" } }, invalidRole);
  assert.equal(invalidRole.statusCode, 400);

  const weakPassword = response();
  await controller.createUser({ body: { ...base, password: "short" } }, weakPassword);
  assert.equal(weakPassword.statusCode, 400);
  assert.equal(hashCalls, 0);

  const duplicate = response();
  await controller.createUser({ user: { sub: "admin-id" }, body: base }, duplicate);
  assert.equal(duplicate.statusCode, 409);
  assert.equal(hashCalls, 1);
});

test("admin updates reject hash injection and protect the last active admin", async () => {
  const controller = createUserAdminController({
    users: {
      findById() { return { select: () => ({ lean: async () => ({ _id: "only-admin", role: "Admin", active: true }) }) }; },
      countDocuments: async () => 0,
      findByIdAndUpdate: async () => { throw new Error("must not update the final admin"); }
    },
    connectDatabase: async () => true,
    recordActivity: async () => {},
    isValidObjectId: () => true
  });

  const injected = response();
  await controller.updateUser({ params: { id: "id" }, body: { passwordHash: "attacker-value" } }, injected);
  assert.equal(injected.statusCode, 400);

  const lastAdmin = response();
  await controller.updateUser({ params: { id: "id" }, body: { active: false } }, lastAdmin);
  assert.equal(lastAdmin.statusCode, 409);
});

test("password reset only updates a hash and rejects weak passwords", async () => {
  let update;
  const controller = createUserAdminController({
    users: { updateOne: async (...args) => { update = args; return { matchedCount: 1 }; } },
    connectDatabase: async () => true,
    hashPassword: async () => "$2b$12$reset-hash",
    recordActivity: async () => {},
    isValidObjectId: () => true
  });
  const weak = response();
  await controller.resetPassword({ params: { id: "id" }, body: { password: "short" } }, weak);
  assert.equal(weak.statusCode, 400);

  const ok = response();
  await controller.resetPassword({ params: { id: "id" }, body: { password: "new-strong-test-password" }, user: { sub: "admin-id" } }, ok);
  assert.equal(ok.statusCode, 204);
  assert.equal(update[1].$set.passwordHash, "$2b$12$reset-hash");
  assert.equal(Object.hasOwn(update[1].$set, "password"), false);
});