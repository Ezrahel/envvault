/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@envvault/shared", "@envvault/ui"],
  experimental: { typedRoutes: false },
};
export default nextConfig;
