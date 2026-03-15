/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#020617', // slate-950
        },
        surface: {
          DEFAULT: '#020617',
          elevated: '#020617',
        },
      },
    },
  },
  plugins: [],
};

