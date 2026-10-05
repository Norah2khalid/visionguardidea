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
        navy: "#061018",
        panel: "#0c1826",
        panel2: "#12263a",
        line: "#23445d",
        ink: "#e7eef4",
        muted: "#8ea3b5",
        cyan: "#38bdf8",
        amber: "#e3a008",
        danger: "#e23d3d",
        ok: "#3dbe7a",
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(35,68,93,0.4)",
      },
    },
  },
  plugins: [],
};
