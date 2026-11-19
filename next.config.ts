import { writeFileSync } from "node:fs";
import type { NextConfig } from "next";

// One id per build. The site publishes it at /version.json and also bakes it into the app,
// so an open page can tell when a newer version has been deployed and update itself.
const BUILD_ID = process.env.BUILD_ID || Date.now().toString(36);
process.env.BUILD_ID = BUILD_ID; // build workers load this file again: keep the same id
try {
  writeFileSync("public/version.json", JSON.stringify({ id: BUILD_ID }) + "\n");
} catch {
  /* read-only checkout: update checks simply stay quiet */
}

const nextConfig: NextConfig = {
  // Static site in ./out, served by Firebase Hosting.
  output: "export",
  images: { unoptimized: true },
  // `npm run build` writes to ./out (see package.json), so it never touches the `.next` folder used by `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  generateBuildId: async () => BUILD_ID,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
};

export default nextConfig;
