/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#13ec80",
        "background-light": "#f6f8f7",
        "background-dark": "#121316",
        "surface-light": "#ffffff",
        "surface-dark": "#1e1f26",
        "text-light": "#0d1b14",
        "text-dark": "#f3f4f6",
        "subtle-light": "#4c9a73",
        "subtle-dark": "#9ca3af",
        "border-light": "#e5e7eb",
        "border-dark": "#2d2f36",
        "primary-subtle-light": "#e7f3ed",
        "primary-subtle-dark": "rgba(19, 236, 128, 0.1)",
        "positive-light": "#07882c",
        "positive-dark": "#10b981",
        "negative-light": "#e72a08",
        "negative-dark": "#f43f5e",
      },
      fontFamily: {
        "sans": ["Lexend", "sans-serif"],
        "display": ["Lexend", "sans-serif"],
        "body": ["Lexend", "sans-serif"]
      },
      keyframes: {
        shrink: {
          '0%': { transform: 'scaleX(1)' },
          '100%': { transform: 'scaleX(0)' },
        }
      },
      animation: {
        'shrink': 'shrink 10s linear forwards',
      }
    },
  },
  plugins: [],
}