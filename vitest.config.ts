import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** Mirrors the `@/*` path alias from tsconfig.json so tests import like the app does. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
