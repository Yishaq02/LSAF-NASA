/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        deepSpace: '#080D1B',
        galacticBlue: '#142B52',
        brightCyan: '#25D9F2',
        cosmicViolet: '#8B5CF6',
        stellarMagenta: '#E879F9',
        solarOrange: '#FFB45E',
        luminousWhite: '#F5F7FF',
        // Legacy compatibility aliases
        void: '#080D1B',
        deck: '#0F1A34',
        moduleHeader: '#142B52',
        borderLine: '#1E3A6E',
        primaryCyan: '#25D9F2',
        alertAmber: '#FFB45E',
        nominalGreen: '#10B981',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Space Grotesk"', 'sans-serif'],
      },
      letterSpacing: {
        tactical: '0.12em',
      },
    },
  },
  plugins: [],
}

