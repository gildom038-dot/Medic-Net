const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");
const typescript = require("typescript");

function loadCommonJs(filename, source) {
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(source, filename);
  return loaded.exports;
}

test("demo data stays in its local storage namespace and blocks API requests", async () => {
  const storage = new Map([["medcnet-production-sentinel", "unchanged"]]);
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  };
  const originalLocalStorage = global.localStorage;
  const originalSessionStorage = global.sessionStorage;
  const originalFetch = global.fetch;
  const originalCrypto = global.crypto;
  let demoEnabled = true;
  let responseToReturn;
  let fetchCalls = 0;

  global.localStorage = localStorage;
  global.sessionStorage = { getItem: (key) => key === "medcnet-demo-session-v1" && demoEnabled ? "true" : null };
  global.fetch = async () => { fetchCalls += 1; return responseToReturn; };
  global.crypto = require("node:crypto").webcrypto;

  try {
    const demoPath = path.resolve(__dirname, "../frontend/src/services/demo.ts");
    const demoSource = typescript.transpile(fs.readFileSync(demoPath, "utf8"), {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022
    });
    const demo = loadCommonJs(demoPath, demoSource);

    const apiPath = path.resolve(__dirname, "../frontend/src/services/api.ts");
    const apiSource = fs.readFileSync(apiPath, "utf8");
    const apiBuild = await esbuild.transform(apiSource, {
      loader: "ts",
      format: "cjs",
      target: "node20",
      define: { "import.meta.env.VITE_API_URL": JSON.stringify("/api") }
    });
    const api = loadCommonJs(apiPath, apiBuild.code).api;

    assert.equal(demo.demoSessionKey, "medcnet-demo-session-v1");
    demo.demoSave("calls", { title: "Fiktiver Testeinsatz" });
    assert.equal(demo.demoList("calls").some((row) => row.title === "Fiktiver Testeinsatz"), true);
    demo.demoRemove("calls", demo.demoList("calls").find((row) => row.title === "Fiktiver Testeinsatz")._id);
    await assert.rejects(api.session(), /Demo-Modus deaktiviert/);
    assert.equal(fetchCalls, 0);

    demoEnabled = false;
    responseToReturn = new Response("Vercel Not Found", { status: 404, headers: { "Content-Type": "text/plain" } });
    await assert.rejects(api.session(), /API-Route nicht gefunden/);
    responseToReturn = new Response("<!doctype html>", { status: 200, headers: { "Content-Type": "text/html" } });
    await assert.rejects(api.session(), /HTML statt JSON/);
    responseToReturn = new Response("{", { status: 200, headers: { "Content-Type": "application/json" } });
    await assert.rejects(api.session(), /ungültiges JSON/);

    assert.equal(fetchCalls, 3);
    assert.equal(storage.get("medcnet-production-sentinel"), "unchanged");
    assert.deepEqual([...storage.keys()].filter((key) => key !== "medcnet-production-sentinel"), ["medcnet-demo-data-v1"]);
  } finally {
    if (originalLocalStorage === undefined) delete global.localStorage;
    else global.localStorage = originalLocalStorage;
    if (originalSessionStorage === undefined) delete global.sessionStorage;
    else global.sessionStorage = originalSessionStorage;
    if (originalFetch === undefined) delete global.fetch;
    else global.fetch = originalFetch;
    if (originalCrypto === undefined) delete global.crypto;
    else global.crypto = originalCrypto;
  }
});