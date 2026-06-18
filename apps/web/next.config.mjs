import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root so Turbopack doesn't pick up stray lockfiles elsewhere.
  // (Linting is handled by the root ESLint config via CI + the husky pre-commit hook;
  // Next 16 removed `next lint`, so there's no build-time ESLint to configure.)
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },
  images: {
    remotePatterns: [
      // Self-hosted covers (Supabase Storage).
      { protocol: "https", hostname: "**.supabase.co" },
      // External CDNs (pre-hosting / fallback).
      { protocol: "https", hostname: "**.royalroadcdn.com" },
      { protocol: "https", hostname: "**.media-amazon.com" },
    ],
  },
};

export default nextConfig;
