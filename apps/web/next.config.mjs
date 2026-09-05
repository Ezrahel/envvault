import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output = tiny Docker runner (`server.js`), no pnpm needed at runtime.
  output: "standalone",
  // Monorepo: trace from workspace root so `standalone/` is portable
  // (otherwise it embeds absolute host paths like /home/user/...).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@envvault/shared", "@envvault/ui"],
  experimental: { typedRoutes: false },
};
export default nextConfig;
