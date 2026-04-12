import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette Forme 1 — énergique, pas médicale
        brand: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          900: "#14532d",
        },
        surface: {
          DEFAULT: "#0f172a",  // fond principal (dark)
          card:    "#1e293b",  // cartes
          muted:   "#334155",  // éléments secondaires
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl:  "1rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
