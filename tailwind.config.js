/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', '"IBM Plex Sans"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        ink: "var(--text)",
        muted: "var(--text-muted)",
        line: "var(--border)",
        accent: "var(--accent)",
        guard: "var(--accent-2)",
      },
      boxShadow: {
        panel: "var(--shadow)",
      },
    },
  },
  plugins: [],
};
