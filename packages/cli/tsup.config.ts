import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  splitting: false,
  bundle: true,
  noExternal: [/@envvault\/.*/],
  platform: "node",
  target: "node18",
  shims: false,
});
