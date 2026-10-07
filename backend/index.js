const http = require("node:http");
const app = require("./app");
const { connectDatabase } = require("./config/database");

const port = Number(process.env.PORT || 4000);
connectDatabase().catch((error) => {
  console.error("MongoDB connection failed; starting API in unavailable-database mode:", error.message);
}).finally(() => {
  const server = http.createServer(app);
  server.listen(port, () => console.log(`MEDCNET API listening on port ${port}`));
});
