const test = require("node:test");
const assert = require("node:assert/strict");
const { requireRole } = require("./auth");

test("admin routes accept privileged roles and reject ordinary users", () => {
  const guard = requireRole("Moderator");
  function check(role) {
    const result = { status: 200, body: null, continued: false };
    const response = {
      status(status) {
        result.status = status;
        return this;
      },
      json(body) {
        result.body = body;
        return this;
      }
    };
    guard({ user: { role } }, response, () => { result.continued = true; });
    return result;
  }

  assert.equal(check("Admin").continued, true);
  assert.equal(check("Moderator").continued, true);
  assert.deepEqual(check("Benutzer"), {
    status: 403,
    body: { error: "Keine Berechtigung für diese Aktion." },
    continued: false
  });
});