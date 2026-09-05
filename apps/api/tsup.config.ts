import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  splitting: false,
  bundle: true,
  // Bundle workspace packages (they point `main` at TS source and can't run under plain node).
  noExternal: [/@envvault\/.*/],
  platform: "node",
  target: "node20",
  shims: false,
});
