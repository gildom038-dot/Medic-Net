const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const apiRoutes = require("./routes");

const app = express();
app.set("trust proxy", 1);
const frontendOrigin = process.env.FRONTEND_URL?.replace(/\/$/, "") || false;
function trustedOrigin(origin, req) {
  if (!origin) return true;
  if (frontendOrigin && origin === frontendOrigin) return true;
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || req.get("host");
  const protocol = req.get("x-forwarded-proto")?.split(",")[0].trim() || req.protocol;
  return Boolean(host && origin === `${protocol}://${host}`);
}
app.use(cors({
  origin: frontendOrigin,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
    && !trustedOrigin(req.headers.origin, req)) {
    return res.status(403).json({ error: "Anfrage-Origin nicht zugelassen." });
  }
  next();
});
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());
app.use("/api", apiRoutes);
app.use("/api", (_req, res) => res.status(404).json({ error: "API-Route nicht gefunden." }));
app.use((err, _req, res, _next) => {
  if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
  if (err.name === "CastError") return res.status(400).json({ error: "Ungültiger Wert." });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Ungültiges JSON." });
  if (err.status === 503) return res.status(503).json({ error: "MongoDB Atlas ist derzeit nicht verfügbar." });
  if ([400, 413].includes(err.status)) return res.status(err.status).json({ error: err.status === 413 ? "Anfrage ist zu groß." : "Ungültige Anfrage." });
  console.error("API request failed:", err.name || "Error");
  res.status(500).json({ error: "Interner API-Fehler." });
});

module.exports = app;
