import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envDir: ".",
  server: {
    port: 5173,
    proxy: { "/api": process.env.MEDCNET_API_PROXY_TARGET || "http://127.0.0.1:4000" }
  },
  build: { outDir: "dist" }
});
