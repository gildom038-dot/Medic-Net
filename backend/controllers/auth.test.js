const test = require("node:test");
const assert = require("node:assert/strict");
const { validDiscordRedirectUri } = require("./auth");

const environmentKeys = ["FRONTEND_URL", "DISCORD_REDIRECT_URI", "NODE_ENV"];
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

test("Discord callback URI must match the frontend origin and callback path", () => {
  try {
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_URL = "https://medcnet.example";
    process.env.DISCORD_REDIRECT_URI = "https://medcnet.example/api/auth/callback";
    assert.equal(validDiscordRedirectUri(), true);

    process.env.DISCORD_REDIRECT_URI = "https://other.example/api/auth/callback";
    assert.equal(validDiscordRedirectUri(), false);
    process.env.DISCORD_REDIRECT_URI = "https://medcnet.example/api/auth/wrong";
    assert.equal(validDiscordRedirectUri(), false);
    process.env.DISCORD_REDIRECT_URI = "http://medcnet.example/api/auth/callback";
    assert.equal(validDiscordRedirectUri(), false);
  } finally {
    for (const key of environmentKeys) {
      if (originalEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    }
  }
});