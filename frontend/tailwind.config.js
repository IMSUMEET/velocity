/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        clay: {
          page: '#EAF1F6',
          content: '#F6F9FC',
          card: '#F8FAFC',
          secondary: '#EEF4F7',
          map: '#F1F6F8',
          sidebar: '#F7FAFC',
          text: '#172033',
          body: '#475569',
          muted: '#64748B',
          blue: '#2563EB',
          teal: '#14B8A6',
          green: '#22C55E',
          orange: '#F97316',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
