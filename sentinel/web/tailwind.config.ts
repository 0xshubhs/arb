import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Near-black canvas of the cockpit.
        ink: {
          DEFAULT: "#05070A",
          900: "#05070A",
          800: "#0A0E14",
          700: "#11161F",
          600: "#171D28",
          500: "#222A38",
        },
        // The ONLY loud thing: risk-state color.
        signal: {
          DEFAULT: "#00E58A",
          dim: "#0B8A57",
          glow: "#00E58A",
        },
        alert: {
          DEFAULT: "#FF3B3B",
          dim: "#8A1414",
          glow: "#FF3B3B",
        },
        caution: "#FFB020",
        muted: {
          DEFAULT: "#5A6678",
          bright: "#8A98AD",
        },
        grid: "#1A212C",
      },
      fontFamily: {
        // confident geometric sans for labels
        sans: ["var(--font-space-grotesk)", "Inter", "system-ui", "sans-serif"],
        // tight monospace for numbers/scores
        mono: ["var(--font-jetbrains-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
      },
      boxShadow: {
        "signal-glow": "0 0 0 1px rgba(0,229,138,0.4), 0 0 24px -4px rgba(0,229,138,0.45)",
        "alert-glow": "0 0 0 1px rgba(255,59,59,0.45), 0 0 28px -2px rgba(255,59,59,0.55)",
        panel: "inset 0 0 0 1px rgba(255,255,255,0.04), 0 18px 40px -24px rgba(0,0,0,0.9)",
      },
      keyframes: {
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "92%": { opacity: "1" },
          "94%": { opacity: "0.55" },
          "96%": { opacity: "1" },
        },
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(255,59,59,0.55)" },
          "70%": { boxShadow: "0 0 0 14px rgba(255,59,59,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255,59,59,0)" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        scanline: "scanline 6s linear infinite",
        flicker: "flicker 5s linear infinite",
        pulseRing: "pulseRing 1.6s ease-out infinite",
        ticker: "ticker 30s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
