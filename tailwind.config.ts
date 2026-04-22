import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "color-mix(in oklch, var(--border) calc(<alpha-value> * 100%), transparent)",
        input: "color-mix(in oklch, var(--input) calc(<alpha-value> * 100%), transparent)",
        ring: "color-mix(in oklch, var(--ring) calc(<alpha-value> * 100%), transparent)",
        background: "color-mix(in oklch, var(--background) calc(<alpha-value> * 100%), transparent)",
        foreground: "color-mix(in oklch, var(--foreground) calc(<alpha-value> * 100%), transparent)",

        primary: {
          DEFAULT: "color-mix(in oklch, var(--primary) calc(<alpha-value> * 100%), transparent)",
          foreground: "color-mix(in oklch, var(--primary-foreground) calc(<alpha-value> * 100%), transparent)",
        },

        secondary: {
          DEFAULT: "color-mix(in oklch, var(--secondary) calc(<alpha-value> * 100%), transparent)",
          foreground: "color-mix(in oklch, var(--secondary-foreground) calc(<alpha-value> * 100%), transparent)",
        },

        destructive: {
          DEFAULT: "color-mix(in oklch, var(--destructive) calc(<alpha-value> * 100%), transparent)",
          foreground: "color-mix(in oklch, var(--destructive-foreground) calc(<alpha-value> * 100%), transparent)",
        },

        muted: {
          DEFAULT: "color-mix(in oklch, var(--muted) calc(<alpha-value> * 100%), transparent)",
          foreground: "color-mix(in oklch, var(--muted-foreground) calc(<alpha-value> * 100%), transparent)",
        },

        accent: {
          DEFAULT: "color-mix(in oklch, var(--accent) calc(<alpha-value> * 100%), transparent)",
          foreground: "color-mix(in oklch, var(--accent-foreground) calc(<alpha-value> * 100%), transparent)",
        },

        popover: {
          DEFAULT: "color-mix(in oklch, var(--popover) calc(<alpha-value> * 100%), transparent)",
          foreground: "color-mix(in oklch, var(--popover-foreground) calc(<alpha-value> * 100%), transparent)",
        },

        card: {
          DEFAULT: "color-mix(in oklch, var(--card) calc(<alpha-value> * 100%), transparent)",
          foreground: "color-mix(in oklch, var(--card-foreground) calc(<alpha-value> * 100%), transparent)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;