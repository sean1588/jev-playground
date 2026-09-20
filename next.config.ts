import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // This app sits below another package-lock.json. Without an explicit root,
  // Turbopack treats the parent folder as the project.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
