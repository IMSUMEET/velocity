import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#eef1f7",     // page background
        surface: "#ffffff",    // cards
        inset: "#f4f6fb",      // recessed areas
        line: "#e4e8f1",       // borders
        ink: {
          DEFAULT: "#1b2238",  // primary text
          soft: "#586179",     // secondary
          faint: "#98a1b3",    // tertiary
        },
        accent: { DEFAULT: "#2563eb", deep: "#1d4ed8" },
        batch: "#7c3aed",      // batch strategies
        greedy: "#64748b",     // greedy strategies
        good: "#059669",
        warn: "#d97706",
        bad: "#dc2626",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(27,34,56,0.04), 0 6px 20px -8px rgba(27,34,56,0.12)",
        "card-hover": "0 2px 4px rgba(27,34,56,0.06), 0 12px 28px -8px rgba(27,34,56,0.18)",
        chip: "0 1px 3px rgba(27,34,56,0.14)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        pulse2: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
      },
      animation: {
        "fade-up": "fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both",
        pulse2: "pulse2 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
