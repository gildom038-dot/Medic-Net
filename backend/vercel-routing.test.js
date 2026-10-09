const test = require("node:test");
const assert = require("node:assert/strict");
const vercel = require("../vercel.json");

test("Vercel SPA fallback excludes API paths but accepts frontend routes", () => {
  const source = vercel.rewrites.find((rewrite) => rewrite.destination === "/index.html")?.source;
  assert.ok(source, "SPA fallback rewrite must be configured");

  const matcher = new RegExp(`^${source}$`);
  assert.equal(matcher.test("/api"), false);
  assert.equal(matcher.test("/api/"), false);
  assert.equal(matcher.test("/api/health"), false);
  assert.equal(matcher.test("/api/auth/session"), false);
  assert.equal(matcher.test("/dispatch"), true);
  assert.equal(matcher.test("/unmatched-frontend-route"), true);
});

test("Vercel uses npm, the Vite output directory, and both API handlers", () => {
  assert.equal(vercel.installCommand, "npm ci");
  assert.equal(vercel.outputDirectory, "frontend/dist");
  assert.ok(vercel.functions["api/index.js"]);
  assert.ok(vercel.functions["api/[...path].js"]);
});