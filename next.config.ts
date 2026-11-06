import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@libsql/client", "bcryptjs"],
};

export default config;
