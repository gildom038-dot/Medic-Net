const test = require("node:test");
const assert = require("node:assert/strict");
const { makeState, validState } = require("./discord");

test("OAuth state token is random and accepted only when identical", () => {
  const first = makeState();
  const second = makeState();
  assert.equal(first.length, 48);
  assert.notEqual(first, second);
  assert.equal(validState(first, first), true);
  assert.equal(validState(first, second), false);
  assert.equal(validState(first, `${first}x`), false);
  assert.equal(validState(undefined, first), false);
});
