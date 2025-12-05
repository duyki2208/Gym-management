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
        "background-dark": "#102219",
        "surface-light": "#ffffff",
        "surface-dark": "#182c22",
        "text-light": "#0d1b14",
        "text-dark": "#e0f2e9",
        "subtle-light": "#4c9a73",
        "subtle-dark": "#7bbf9a",
        "border-light": "#cfe7db",
        "border-dark": "#2d523f",
        "primary-subtle-light": "#e7f3ed",
        "primary-subtle-dark": "rgba(19, 236, 128, 0.1)",
        "positive-light": "#07882c",
        "positive-dark": "#50c878",
        "negative-light": "#e72a08",
        "negative-dark": "#ff6b6b",
      },
      fontFamily: {
        "display": ["Lexend", "sans-serif"],
        "body": ["Manrope", "sans-serif"]
      },
    },
  },
  plugins: [],
}