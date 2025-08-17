/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ["*"] }
  }
};
module.exports = nextConfig;


// allow external images (Blob, etc.)
module.exports.images = Object.assign({}, module.exports.images||{}, { remotePatterns:[{protocol:'https',hostname:'**'},{protocol:'http',hostname:'**'}] });
