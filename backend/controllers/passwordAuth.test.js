const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createLoginController } = require("./passwordAuth");
const { hashPassword, verifyPassword } = require("../services/passwords");

function fixture({ user, connected = true, limited = false, secretAvailable = true, verify } = {}) {
  const events = [];
  const logs = [];
  const response = {
    statusCode: 200,
    body: null,
    cookies: [],
    status(status) { this.statusCode = status; return this; },
    json(body) { this.body = body; return this; },
    cookie(name, value, options) { this.cookies.push({ name, value, options }); return this; }
  };
  const users = {
    findOne(filter) {
      events.push(["find", filter]);
      return { select: (fields) => {
        assert.equal(fields, "+passwordHash");
        return { lean: async () => user || null };
      } };
    },
    async updateOne(...args) { events.push(["update", ...args]); }
  };
  const login = createLoginController({
    users,
    connectDatabase: async () => connected,
    getJwtSecret: () => {
      if (!secretAvailable) throw new Error("secret unavailable");
      return "test-only-secret-for-controller-tests-123456";
    },
    loginRateLimiter: {
      consume: async (ip) => { events.push(["limit", ip]); return { key: "test-key", limited }; },
      clear: async (key) => events.push(["clear", key])
    },
    verifyPassword: verify || (async (password, hash) => Boolean(hash && password === "correct-test-password")),
    recordActivity: async (...args) => events.push(["audit", ...args]),
    signToken: (claims) => { events.push(["sign", claims]); return "signed-test-session"; },
    logger: {
      info: (message) => logs.push(message),
      warn: (message) => logs.push(message),
      error: (message) => logs.push(message)
    }
  });
  return { login, response, events, logs };
}

test("successful password login signs a server-derived session and returns no hash", async () => {
  const password = `test-${crypto.randomBytes(16).toString("hex")}`;
  const passwordHash = await hashPassword(password);
  const { login, response, events, logs } = fixture({
    user: { _id: "user-1", serviceNumber: "PERS-100001", displayName: "Test Staff", role: "Rettungsdienst", active: true, passwordHash },
    verify: verifyPassword
  });
  const originalEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    await login({ body: { serviceNumber: " pers-100001 ", password, role: "Admin" }, ip: "192.0.2.10" }, response);
  } finally {
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
  }

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { user: { sub: "user-1", name: "Test Staff", role: "Rettungsdienst", serviceNumber: "PERS-100001" } });
  assert.equal(JSON.stringify(response.body).includes(passwordHash), false);
  assert.deepEqual(response.cookies[0], {
    name: "medcnet_session",
    value: "signed-test-session",
    options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 28_800_000 }
  });
  assert.deepEqual(events.find(([event]) => event === "sign")[1], {
    sub: "user-1", name: "Test Staff", role: "Rettungsdienst", serviceNumber: "PERS-100001", authVersion: 0
  });
  assert.equal(logs.join(" ").includes(password), false);
  assert.equal(logs.join(" ").includes("PERS-100001"), false);
});

test("unknown service number and incorrect password share one unauthorized response", async () => {
  const scenarios = [
    fixture({ user: null }),
    fixture({ user: { _id: "user-1", passwordHash: "stored-hash", active: true }, verify: async () => false })
  ];
  for (const scenario of scenarios) {
    await scenario.login({ body: { serviceNumber: "PERS-UNKNOWN", password: "wrong-test-password" }, ip: "192.0.2.20" }, scenario.response);
    assert.equal(scenario.response.statusCode, 401);
    assert.deepEqual(scenario.response.body, { error: "Dienstnummer oder Passwort ist ungültig." });
  }
});

test("missing credentials do not reach the database", async () => {
  const scenario = fixture();
  await scenario.login({ body: { serviceNumber: "", password: "" } }, scenario.response);
  assert.equal(scenario.response.statusCode, 400);
  assert.equal(scenario.events.length, 0);
});

test("inactive accounts and rate-limited clients cannot sign in", async () => {
  const inactive = fixture({ user: { _id: "disabled", passwordHash: "stored-hash", active: false }, verify: async () => true });
  await inactive.login({ body: { serviceNumber: "PERS-000001", password: "correct-test-password" } }, inactive.response);
  assert.equal(inactive.response.statusCode, 401);

  const limited = fixture({ limited: true });
  await limited.login({ body: { serviceNumber: "PERS-000001", password: "correct-test-password" } }, limited.response);
  assert.equal(limited.response.statusCode, 429);
});

test("missing database and JWT configuration fail closed with JSON", async () => {
  const noDatabase = fixture({ connected: false });
  await noDatabase.login({ body: { serviceNumber: "PERS-000001", password: "correct-test-password" } }, noDatabase.response);
  assert.equal(noDatabase.response.statusCode, 503);

  const noSecret = fixture({ secretAvailable: false });
  await noSecret.login({ body: { serviceNumber: "PERS-000001", password: "correct-test-password" } }, noSecret.response);
  assert.equal(noSecret.response.statusCode, 503);
});