import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    include: ["packages/*/src/**/*.test.ts", "tests/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    environment: "node",
    alias: {
      "@envvault/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@envvault/git": path.resolve(__dirname, "packages/git/src/index.ts"),
      "@envvault/crypto": path.resolve(__dirname, "packages/crypto/src/index.ts"),
      "@envvault/env-parser": path.resolve(__dirname, "packages/env-parser/src/index.ts"),
      "@envvault/config": path.resolve(__dirname, "packages/config/src/index.ts"),
      "@envvault/sdk": path.resolve(__dirname, "packages/sdk/src/index.ts"),
    },
  },
});
