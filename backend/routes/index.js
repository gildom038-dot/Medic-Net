const express = require("express");
const mongoose = require("mongoose");
const auth = require("../controllers/auth");
const resources = require("../controllers/resources");
const asyncRoute = require("../middleware/asyncRoute");
const { authenticate, requireRole } = require("../middleware/auth");
const { connectDatabase } = require("../config/database");

const router = express.Router();
const resource = (name) => (req, _res, next) => {
  req.params.resource = name;
  next();
};

router.get("/health", asyncRoute(async (_req, res) => {
  try {
    const connected = await connectDatabase();
    if (!connected) return res.status(503).json({ status: "degraded", service: "medcnet-api", databaseConnected: false });
    return res.json({ status: "ok", service: "medcnet-api", databaseConnected: mongoose.connection.readyState === 1 });
  } catch (error) {
    console.error("Health check database connection failed:", error.message);
    return res.status(503).json({ status: "degraded", service: "medcnet-api", databaseConnected: false });
  }
}));
router.get("/auth/session", asyncRoute(auth.session));
router.get("/auth/discord", asyncRoute(auth.startDiscord));
router.get("/auth/callback", asyncRoute(auth.finishDiscord));
router.get("/auth/me", authenticate, auth.currentUser);
router.post("/auth/logout", authenticate, auth.logout);
router.get("/profile", authenticate, asyncRoute(resources.getProfile));
router.patch("/profile", authenticate, asyncRoute(resources.updateProfile));
router.get("/dashboard", authenticate, asyncRoute(resources.dashboard));
router.get("/stats", authenticate, asyncRoute(resources.stats));
router.get("/admin", authenticate, requireRole("Moderator"), asyncRoute(resources.stats));
router.get("/dispatch", authenticate, resource("calls"), asyncRoute(resources.list));
router.post("/dispatch", authenticate, resource("calls"), asyncRoute(resources.create));
router.patch("/dispatch/:id", authenticate, resource("calls"), asyncRoute(resources.update));
router.delete("/dispatch/:id", authenticate, resource("calls"), asyncRoute(resources.remove));
router.get("/hospital", authenticate, resource("patients"), asyncRoute(resources.list));
router.get("/radio", authenticate, resource("radio_channels"), asyncRoute(resources.list));
router.get("/admin/logs", authenticate, requireRole("Moderator"), resource("activity_logs"), asyncRoute(resources.list));
router.get("/admin/users", authenticate, requireRole("Moderator"), resource("users"), asyncRoute(resources.list));
router.patch("/admin/users/:id", authenticate, requireRole("Moderator"), resource("users"), asyncRoute(resources.update));
router.get("/:resource", authenticate, asyncRoute(resources.list));
router.post("/:resource", authenticate, asyncRoute(resources.create));
router.patch("/:resource/:id", authenticate, asyncRoute(resources.update));
router.delete("/:resource/:id", authenticate, asyncRoute(resources.remove));

module.exports = router;
