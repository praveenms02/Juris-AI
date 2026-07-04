import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Loaded from `frontend/.env`, `frontend/.env.local`, etc.
  const env = loadEnv(mode, process.cwd(), "");
  const target = (env.VITE_BACKEND_ORIGIN || "http://127.0.0.1:5010").replace(/\/$/, "");

  // Long document + AI pipeline can exceed default proxy timeouts.
  const apiProxy = {
    "/api": {
      target,
      changeOrigin: true,
      timeout: 900_000,
      proxyTimeout: 900_000,
    },
    // Socket.IO — proxy both HTTP polling and WebSocket upgrade
    "/socket.io": {
      target,
      changeOrigin: true,
      ws: true,
      timeout: 900_000,
    },
  };

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: apiProxy,
    },
    preview: {
      port: 4173,
      proxy: apiProxy,
    },
  };
});
