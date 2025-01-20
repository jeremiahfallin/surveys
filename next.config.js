/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // This allows all HTTPS URLs - adjust based on your image sources
      },
    ],
  },
};

module.exports = nextConfig;
