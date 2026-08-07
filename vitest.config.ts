import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@mfa/contracts": fileURLToPath(
        new URL("./packages/contracts/src/index.ts", import.meta.url)
      ),
      "@mfa/decision-core": fileURLToPath(
        new URL("./packages/decision-core/src/index.ts", import.meta.url)
      ),
      "@mfa/demo-data": fileURLToPath(
        new URL("./packages/demo-data/src/index.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/**/tests/**/*.test.ts",
      "apps/api/tests/**/*.test.ts",
    ],
  },
});
