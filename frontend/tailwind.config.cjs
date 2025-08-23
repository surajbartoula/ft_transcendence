/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,js}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'BitcountGridDouble': ['BitcountGridDouble', 'sans-serif'],
      }
	},
  },
  plugins: [],
};
