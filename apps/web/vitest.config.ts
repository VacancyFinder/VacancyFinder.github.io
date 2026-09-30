import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __SITE_URL__: JSON.stringify("https://vacancyfinder.github.io") },
  test: { environment: "jsdom", include: ["test/**/*.test.{ts,tsx}"] },
});
