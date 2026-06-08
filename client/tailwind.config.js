/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#35654d',
          dark: '#2a5040',
          light: '#3d7a5c',
        },
        wood: {
          DEFAULT: '#8B5E3C',
          dark: '#6b4423',
          light: '#a0703d',
        },
        gold: {
          DEFAULT: '#d4af37',
          light: '#f0d060',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
