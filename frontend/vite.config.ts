import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxyTarget = process.env.MEDCNET_API_PROXY_TARGET;

export default defineConfig({
  plugins: [react()],
  envDir: ".",
  server: {
    port: 5173,
    ...(apiProxyTarget ? { proxy: { "/api": apiProxyTarget } } : {})
  },
  build: { outDir: "dist" }
});
