/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
      colors: {
        unerg: {
          950: '#020818',
          900: '#040f2b',
          800: '#071640',
          700: '#0a1f5c',
          600: '#0d2878',
          500: '#1034a6',
          400: '#2563eb',
          300: '#60a5fa',
          200: '#bfdbfe',
        },
        cyan: {
          electric: '#00e5ff',
          glow:     '#00b4d8',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
