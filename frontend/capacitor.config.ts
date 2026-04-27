import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.nnonogram.arena",
  appName: "Nonogram Arena",
  webDir: "dist",
  server: {
    androidScheme: "http",
  },
};

export default config;
