/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal, self-contained server bundle (.next/standalone)
  // instead of relying on a full node_modules install at runtime — this
  // is what lets the desktop (Electron) build embed and launch the app's
  // own server without the user needing Node.js installed separately.
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

module.exports = nextConfig;
