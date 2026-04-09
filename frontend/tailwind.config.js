/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        instruments: {
          bg: '#1e1e1e',
          surface: '#252526',
          surfaceHover: '#2a2d2e',
          border: '#3e3e42',
          text: '#cccccc',
          textDim: '#858585',
          accent: '#0a84ff',
          accentHover: '#409cff',
          green: '#30d158',
          red: '#ff453a',
          orange: '#ff9f0a',
          yellow: '#ffd60a',
          purple: '#bf5af2',
          teal: '#64d2ff',
          track1: '#0a84ff',
          track2: '#30d158',
          track3: '#ff9f0a',
          track4: '#bf5af2',
          track5: '#ff453a',
        },
      },
      fontFamily: {
        mono: ['SF Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Helvetica Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
