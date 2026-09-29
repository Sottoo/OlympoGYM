import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Genera un servidor autónomo que la app de escritorio (electron/) lleva dentro.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
