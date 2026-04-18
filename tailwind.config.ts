import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a1a",
        paper: "#fafaf7",
        accent: "#b85c38",
        muted: "#6b6b66",
        border: "#e7e5dc",
        good: "#3f7d3f",
        warn: "#a06a00",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "PingFang SC", "Noto Sans SC", "sans-serif"],
        serif: ["ui-serif", "Georgia", "Songti SC", "Noto Serif SC", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
