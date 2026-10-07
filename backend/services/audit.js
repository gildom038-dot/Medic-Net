const { models } = require("../models");

async function recordActivity(actor, action, entity, entityId) {
  await models.activity_logs.create({ actor, action, entity, entityId: String(entityId) });
}

module.exports = { recordActivity };
