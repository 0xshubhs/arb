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
        // Design tokens — the only palette this app speaks.
        canvas: "#0B0E14",
        ink: "#0B0E14",
        // In-bounds / agent acting within policy.
        bound: {
          DEFAULT: "#14E08A",
          dim: "#0E9F62",
        },
        // Breach / kill-switch.
        breach: {
          DEFAULT: "#FF5C5C",
          dim: "#B83C3C",
        },
        // Revoked state.
        amber: {
          DEFAULT: "#FFB020",
          dim: "#B87A14",
        },
        // Neutral terminal greys layered on the ink canvas.
        panel: "#11161F",
        panel2: "#161C28",
        hair: "rgba(255,255,255,0.08)",
        hairsoft: "rgba(255,255,255,0.04)",
        mute: "#7E8694",
        faint: "#4A515E",
      },
      fontFamily: {
        // Inter Tight for UI; IBM Plex Mono for every number.
        sans: ["var(--font-inter-tight)", "Inter Tight", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      backdropBlur: {
        glass: "18px",
      },
      borderRadius: {
        card: "18px",
      },
      boxShadow: {
        glass: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -30px rgba(0,0,0,0.8)",
        glow: "0 0 0 1px rgba(20,224,138,0.35), 0 0 40px -8px rgba(20,224,138,0.45)",
        glowRed: "0 0 0 1px rgba(255,92,92,0.4), 0 0 48px -8px rgba(255,92,92,0.5)",
        glowAmber: "0 0 0 1px rgba(255,176,32,0.4), 0 0 48px -8px rgba(255,176,32,0.5)",
      },
      keyframes: {
        pulseGreen: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
      animation: {
        pulseGreen: "pulseGreen 2.4s ease-in-out infinite",
        scanline: "scanline 6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
