import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#24324a",
        paper: "#FAF7F2",
        accent: "#3B5BA5",
        muted: "#667085",
        border: "#DDD6C8",
        good: "#6BA368",
        warn: "#E8896B",
        jade: "#6BA368",
        coral: "#E8896B",
        mist: "#EEF2FA",
        cream: "#FFFDFC",
        line: "#C9D3E8",
      },
      fontFamily: {
        sans: ["Inter", "\"Noto Sans SC\"", "\"PingFang HK\"", "\"PingFang SC\"", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        serif: ["\"Noto Serif SC\"", "\"Source Han Serif SC\"", "\"Songti SC\"", "Georgia", "ui-serif", "serif"],
      },
      boxShadow: {
        soft: "0 20px 50px -28px rgba(36, 50, 74, 0.28)",
        float: "0 28px 70px -34px rgba(59, 91, 165, 0.25)",
      },
      borderRadius: {
        shell: "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
