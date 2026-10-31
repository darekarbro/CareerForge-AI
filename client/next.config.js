/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Optional cap for CI or machines with little available build memory.
  ...(process.env.NEXT_BUILD_WORKERS ? {
    experimental: { cpus: Math.max(1, Math.min(4, parseInt(process.env.NEXT_BUILD_WORKERS, 10) || 1)) },
  } : {}),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000',
  },
};

module.exports = nextConfig;
