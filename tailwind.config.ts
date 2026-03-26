/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          500: '#2E5BA8',
          600: '#1B3A6B',
          700: '#152D54',
          800: '#0D1F3C',
          900: '#080C14',
        },
        coral: {
          50:  '#FFF1F2',
          100: '#FFE4E6',
          400: '#FF5260',
          500: '#E63946',
          600: '#C82333',
        },
        gold: {
          400: '#E8B455',
          500: '#C9963A',
          600: '#A67C2E',
        },
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      boxShadow: {
        'navy': '0 4px 24px rgba(27,58,107,0.12)',
        'navy-lg': '0 12px 40px rgba(27,58,107,0.18)',
      },
    },
  },
  plugins: [],
};
