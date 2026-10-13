/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        freight: {
          navy: '#0f172a',
          blue: '#1e293b',
          amber: '#f59e0b',
          orange: '#ea580c',
        }
      }
    },
  },
  plugins: [],
}
