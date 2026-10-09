const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const environmentKeys = [
  "MONGODB_URI",
  "MONGODB_DATABASE",
  "JWT_SECRET",
  "FRONTEND_URL",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_REDIRECT_URI",
  "DISCORD_GUILD_ID"
];
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
for (const key of environmentKeys) process.env[key] = "";

const server = http.createServer(require("../api/[...path]")).listen(0, "127.0.0.1");
const discordServer = http.createServer(require("../api/auth/discord")).listen(0, "127.0.0.1");
const sessionServer = http.createServer(require("../api/auth/session")).listen(0, "127.0.0.1");
const callbackServer = http.createServer(require("../api/auth/callback")).listen(0, "127.0.0.1");
const logoutServer = http.createServer(require("../api/auth/logout")).listen(0, "127.0.0.1");
const loginServer = http.createServer(require("../api/auth/login")).listen(0, "127.0.0.1");
const adminUsersServer = http.createServer(require("../api/admin/users")).listen(0, "127.0.0.1");
const adminUserServer = http.createServer(require("../api/admin/users/[id]")).listen(0, "127.0.0.1");
const adminPasswordServer = http.createServer(require("../api/admin/users/[id]/password")).listen(0, "127.0.0.1");
const indexServer = http.createServer(require("../api/index")).listen(0, "127.0.0.1");

async function request(path, options, target = server) {
  if (!target.listening) await new Promise((resolve) => target.once("listening", resolve));
  const address = target.address();
  return fetch(`http://127.0.0.1:${address.port}${path}`, options);
}

test("health always returns JSON and reports missing MongoDB configuration", async () => {
  const response = await request("/api/health");
  assert.equal(response.status, 503);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await response.json(), {
    status: "degraded",
    service: "medcnet-api",
    databaseConnected: false,
    reason: "missing_configuration",
    missingConfiguration: ["MONGODB_URI", "MONGODB_DATABASE"]
  });
});

test("static Vercel session route returns an unauthenticated JSON session", async () => {
  const response = await request("/api/auth/session", undefined, sessionServer);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await response.json(), { user: null });
});

test("static Vercel login route validates required credentials", async () => {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serviceNumber: "", password: "" })
  }, loginServer);
  assert.equal(response.status, 400);
  assert.match(response.headers.get("content-type"), /application\/json/);
});

test("admin user endpoints remain protected by the server session", async () => {
  for (const [path, target] of [
    ["/api/admin/users", adminUsersServer],
    ["/api/admin/users/64b000000000000000000001", adminUserServer],
    ["/api/admin/users/64b000000000000000000001/password", adminPasswordServer]
  ]) {
    const response = await request(path, undefined, target);
    assert.equal(response.status, 401, path);
    assert.match(response.headers.get("content-type"), /application\/json/, path);
  }
});

test("the index function keeps the /api root in JSON", async () => {
  const response = await request("/api", undefined, indexServer);
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /application\/json/);
});

test("Discord login and callback are disabled with an explicit JSON response", async () => {
  for (const [path, target] of [["/api/auth/discord", discordServer], ["/api/auth/callback", callbackServer]]) {
    const response = await request(path, undefined, target);
    assert.equal(response.status, 410, path);
    assert.match(response.headers.get("content-type"), /application\/json/, path);
    assert.match((await response.json()).error, /Discord-Anmeldung.*deaktiviert/, path);
  }
});

test("missing JWT configuration is reported as JSON for a cookie-backed session", async () => {
  const response = await request("/api/auth/session", { headers: { Cookie: "medcnet_session=token" } });
  assert.equal(response.status, 503);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.match((await response.json()).error, /JWT_SECRET/);
});

test("valid signed sessions report missing MongoDB configuration as JSON", async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "a".repeat(48);
  const token = require("jsonwebtoken").sign({ sub: "64b000000000000000000001" }, process.env.JWT_SECRET);
  try {
    for (const path of ["/api/auth/session", "/api/auth/me"]) {
      const response = await request(path, { headers: { Cookie: `medcnet_session=${token}` } });
      assert.equal(response.status, 503, path);
      assert.match(response.headers.get("content-type"), /application\/json/, path);
      assert.match((await response.json()).error, /MONGODB_URI/, path);
    }
  } finally {
    process.env.JWT_SECRET = originalSecret;
  }
});

test("protected and admin routes reject requests without a session", async () => {
  for (const path of ["/api/auth/me", "/api/admin", "/api/admin/logs"]) {
    const response = await request(path);
    assert.equal(response.status, 401, path);
    assert.match(response.headers.get("content-type"), /application\/json/, path);
  }
});


test("unknown API paths return a JSON 404", async () => {
  const missingPaths = ["/api/not/a/known/route", "/api/not-a-resource"];

  for (const path of missingPaths) {
    const response = await request(path);
    assert.equal(response.status, 404, path);
    assert.match(response.headers.get("content-type"), /application\/json/, path);
    assert.equal(typeof (await response.json()).error, "string", path);
  }
});

test("malformed JSON returns a JSON 400", async () => {
  const response = await request("/api/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{"
  });
  assert.equal(response.status, 400);
  assert.match(response.headers.get("content-type"), /application\/json/);
});

test("logout clears the session cookie without requiring MongoDB", async () => {
  const response = await request("/api/auth/logout", { method: "POST" }, logoutServer);
  assert.equal(response.status, 204);
  assert.match(response.headers.get("set-cookie"), /medcnet_session=;/);
});

test.after(async () => {
  for (const target of [server, discordServer, sessionServer, callbackServer, logoutServer, loginServer, adminUsersServer, adminUserServer, adminPasswordServer, indexServer]) {
    await new Promise((resolve, reject) => target.close((error) => error ? reject(error) : resolve()));
  }
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});