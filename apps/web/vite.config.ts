import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@mfa/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url)
      ),
      "@mfa/demo-data": fileURLToPath(
        new URL("../../packages/demo-data/src/index.ts", import.meta.url)
      ),
      "@mfa/policy-bundles": fileURLToPath(
        new URL("../../packages/policy-bundles/src/index.ts", import.meta.url)
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
      "/health": "http://localhost:4000",
    },
  },
});
