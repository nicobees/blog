/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './build-pages.ts'],
  plugins: [],
  theme: {
    extend: {
      colors: {
        primary: '#2180a5',
        'primary-hover': '#1d6a85',
      },
    },
  },
};
