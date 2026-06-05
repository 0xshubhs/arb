/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // wagmi/viem ship optional peer deps (e.g. WalletConnect's pino logger) that
  // pull in Node-only modules; mark them external so the client bundle builds clean.
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
