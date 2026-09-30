import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { rekiyaData } from "./build/data-plugin.js";

const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");

export default defineConfig({
  // Relative base: works at the user-site root and in any sub-path preview.
  base: "./",
  plugins: [
    react(),
    rekiyaData(DATA_DIR),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "icon-maskable.svg"],
      manifest: {
        name: "Rekiya — Sri Lanka jobs",
        short_name: "Rekiya",
        description: "Let us do the searching. You do the applying. Open vacancies from Sri Lankan company career pages.",
        theme_color: "#123760",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            // Job data: show the last copy instantly (and offline), refresh in the background.
            urlPattern: ({ url }) => url.pathname.includes("/data/"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "rekiya-data", expiration: { maxEntries: 80, maxAgeSeconds: 14 * 86400 } },
          },
        ],
      },
    }),
  ],
  build: { target: "es2020", sourcemap: false },
});
