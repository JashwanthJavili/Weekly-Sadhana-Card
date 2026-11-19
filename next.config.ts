import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static site in ./out, served by Firebase Hosting.
  output: "export",
  images: { unoptimized: true },
  // `npm run build` writes to ./out (see package.json), so it never touches the `.next` folder used by `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
