/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  type: "module",
  swcMinify: true,
  experimental: {
    appDir: true
  }
};

export default nextConfig;
