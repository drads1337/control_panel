/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
        display: ["Outfit", "sans-serif"],
        body: ["Outfit", "sans-serif"],
        "mono-numbers": ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        'glow': '0 0 10px rgba(226, 232, 240, 0.1)',
        'glow-focus': '0 0 15px rgba(226, 232, 240, 0.15)',
        'danger-glow': '0 0 10px rgba(239, 68, 68, 0.15)',
      },
    },
  },
}

