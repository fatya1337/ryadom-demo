import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  output: process.env.STATIC_EXPORT === "1" ? "export" : undefined,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
