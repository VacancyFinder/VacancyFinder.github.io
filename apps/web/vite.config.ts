import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { rekiyaData, siteUrl } from "./build/data-plugin.js";

const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");

export default defineConfig({
  // Absolute base: clean URLs (/job/…/, /jobs/<field>/) load assets from the site root.
  base: "/",
  define: { __SITE_URL__: JSON.stringify(siteUrl()) },
  plugins: [
    react(),
    rekiyaData(DATA_DIR),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "icon-maskable.svg"],
      manifest: {
        name: "Rekiya — Jobs in Sri Lanka",
        short_name: "Rekiya",
        description: "The latest job vacancies in Sri Lanka from employers' own career pages, updated every 3 hours.",
        id: "/",
        lang: "en-LK",
        categories: ["business", "productivity"],
        theme_color: "#123760",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        shortcuts: [
          { name: "Latest jobs", url: "/jobs/", icons: [{ src: "icon-192.png", sizes: "192x192" }] },
          { name: "Saved jobs", url: "/saved/", icons: [{ src: "icon-192.png", sizes: "192x192" }] },
        ],
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
      },
      workbox: {
        // The app shell only — never the ~900 prerendered pages (those are for crawlers and first loads).
        globPatterns: ["*.{js,css,html,svg,png}", "assets/**/*.{js,css,woff2}"],
        globIgnores: ["404.html", "og-image.png"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/\.(xml|txt|json)$/, /^\/feeds\//, /^\/data\//],
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
