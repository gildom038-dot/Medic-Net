const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyVitals } = require("./vitals");

const normal = { pulse: 78, respiratoryRate: 16, temperature: 36.7, oxygenSaturation: 98, bloodPressure: "120/80" };

test("vital classification distinguishes normal, warning, and critical values", () => {
  assert.equal(classifyVitals(normal), "Normal");
  assert.equal(classifyVitals({ ...normal, pulse: 105 }), "Warnung");
  assert.equal(classifyVitals({ ...normal, oxygenSaturation: 88 }), "Kritisch");
  assert.equal(classifyVitals({ ...normal, temperature: 40 }), "Kritisch");
});
