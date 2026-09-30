/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4fb",
          100: "#d9e5f4",
          200: "#b6cce9",
          300: "#86a9d8",
          400: "#5582c2",
          500: "#3464a8",
          600: "#254f8c",
          700: "#1c4274",
          800: "#123760",
          900: "#0d2747",
          950: "#081a31",
        },
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
