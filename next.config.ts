import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import path from "node:path";
import { assertFirebasePublicEnv } from "./lib/env";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default function config(phase: string) {
  if (phase === PHASE_PRODUCTION_BUILD) {
    assertFirebasePublicEnv();
  }

  return nextConfig;
}
