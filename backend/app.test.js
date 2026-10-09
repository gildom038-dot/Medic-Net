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
const nestedServer = http.createServer(require("../api/[resource]/[...path]")).listen(0, "127.0.0.1");
const discordServer = http.createServer(require("../api/auth/discord")).listen(0, "127.0.0.1");
const sessionServer = http.createServer(require("../api/auth/session")).listen(0, "127.0.0.1");
const callbackServer = http.createServer(require("../api/auth/callback")).listen(0, "127.0.0.1");
const logoutServer = http.createServer(require("../api/auth/logout")).listen(0, "127.0.0.1");
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

test("the index function keeps the /api root in JSON", async () => {
  const response = await request("/api", undefined, indexServer);
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /application\/json/);
});

test("the nested Vercel function routes Discord auth through Express", async () => {
  const response = await request("/api/auth/discord", { redirect: "manual" }, discordServer);
  assert.equal(response.status, 302);
  assert.match(response.headers.get("location"), /authError=databaseConfig/);

  const apiResponse = await request("/api/auth/discord", {
    headers: { Accept: "application/json" }
  }, discordServer);
  assert.equal(apiResponse.status, 503);
  assert.match(apiResponse.headers.get("content-type"), /application\/json/);
  assert.match((await apiResponse.json()).error, /MONGODB_URI/);
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
  const deepResponse = await request("/api/not/a/known/route", undefined, nestedServer);
  assert.equal(deepResponse.status, 404);
  assert.match(deepResponse.headers.get("content-type"), /application\/json/);
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

test("OAuth start reports missing configuration and callback rejects missing state", async () => {
  const start = await request("/api/auth/discord", { redirect: "manual" });
  assert.equal(start.status, 302);
  assert.match(start.headers.get("location"), /authError=databaseConfig/);

  const callback = await request("/api/auth/callback?code=not-used&state=invalid", { redirect: "manual" }, callbackServer);
  assert.equal(callback.status, 302);
  assert.match(callback.headers.get("location"), /authError=discord/);
});

test("OAuth start validates configuration and creates a state-bound Discord redirect", async () => {
  const keys = [
    "MONGODB_URI", "MONGODB_DATABASE", "JWT_SECRET", "FRONTEND_URL", "NODE_ENV",
    "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_REDIRECT_URI", "DISCORD_GUILD_ID"
  ];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.MONGODB_URI = "test-uri-without-credentials";
    process.env.MONGODB_DATABASE = "medcnet_test";
    const missingOauth = await request("/api/auth/discord", {
      headers: { Accept: "application/json" }
    }, discordServer);
    assert.equal(missingOauth.status, 503);
    assert.match((await missingOauth.json()).error, /DISCORD_CLIENT_ID/);

    Object.assign(process.env, {
      MONGODB_URI: "test-uri-without-credentials",
      MONGODB_DATABASE: "medcnet_test",
      JWT_SECRET: "test-only-jwt-secret-not-used-outside-this-test-123456",
      FRONTEND_URL: "https://medcnet.example",
      NODE_ENV: "production",
      DISCORD_CLIENT_ID: "test-client-id",
      DISCORD_CLIENT_SECRET: "test-only-client-secret",
      DISCORD_REDIRECT_URI: "https://medcnet.example/api/auth/callback",
      DISCORD_GUILD_ID: "test-guild-id"
    });

    process.env.DISCORD_REDIRECT_URI = "https://medcnet.example/wrong-path";
    const invalidRedirect = await request("/api/auth/discord", {
      headers: { Accept: "application/json" }
    }, discordServer);
    assert.equal(invalidRedirect.status, 503);
    assert.match((await invalidRedirect.json()).error, /DISCORD_REDIRECT_URI/);
    process.env.DISCORD_REDIRECT_URI = "https://medcnet.example/api/auth/callback";

    const response = await request("/api/auth/discord", { redirect: "manual" }, discordServer);
    assert.equal(response.status, 302);
    const location = new URL(response.headers.get("location"));
    assert.equal(location.origin, "https://discord.com");
    assert.equal(location.pathname, "/oauth2/authorize");
    assert.equal(location.searchParams.get("client_id"), "test-client-id");
    assert.equal(location.searchParams.get("redirect_uri"), "https://medcnet.example/api/auth/callback");
    assert.equal(location.searchParams.get("scope"), "identify guilds.members.read");
    const stateCookie = response.headers.get("set-cookie");
    assert.match(stateCookie, /medcnet_oauth_state=/);
    assert.match(stateCookie, /HttpOnly/i);
    assert.match(stateCookie, /Secure/i);
    assert.match(stateCookie, /SameSite=Lax/i);
    assert.equal(location.searchParams.get("state"), stateCookie.match(/medcnet_oauth_state=([^;]+)/)[1]);
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});

test.after(async () => {
  for (const target of [server, nestedServer, discordServer, sessionServer, callbackServer, logoutServer, indexServer]) {
    await new Promise((resolve, reject) => target.close((error) => error ? reject(error) : resolve()));
  }
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});