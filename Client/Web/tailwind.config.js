/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Override default sans font to use CSS variable (set by i18n based on language)
        sans: ['var(--font-family)'],
      },
    },
  },
  plugins: [],
}
