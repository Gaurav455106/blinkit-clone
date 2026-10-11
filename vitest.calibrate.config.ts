// Calibration runs (`npm run calibrate`): slow 30-day headless runs per brand,
// kept out of the normal `npm test`.
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/market/calibration/**/*.calibration.ts"],
    environment: "node",
    testTimeout: 120_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
