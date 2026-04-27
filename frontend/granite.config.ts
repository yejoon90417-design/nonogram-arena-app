import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "nonogram-arena",
  brand: {
    displayName: "노노그램 아레나",
    primaryColor: "#2563EB",
    icon: "https://www.nnonogram.com/favicon-64.png",
  },
  web: {
    host: "192.168.45.139",
    port: 5174,
    commands: {
      dev: "vite dev --host 0.0.0.0 --port 5174 --mode appsintoss",
      build: "vite build --mode appsintoss",
    },
  },
  permissions: [],
  outdir: "dist",
});
