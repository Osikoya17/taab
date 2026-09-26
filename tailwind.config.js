const palette = require('./src/constants/palette');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // taab ships a single light theme; class mode stops NativeWind following the OS on web.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: palette.canvas,
        surface: palette.surface,
        sunken: palette.sunken,
        ink: palette.ink,
        muted: palette.muted,
        faint: palette.faint,
        line: palette.line,
        'line-strong': palette.lineStrong,
        positive: palette.positive,
        'positive-soft': palette.positiveSoft,
        negative: palette.negative,
        'negative-soft': palette.negativeSoft,
        accent: palette.accent,
        'accent-soft': palette.accentSoft,
      },
      fontFamily: {
        geist: ["Geist_400Regular"],
        "geist-medium": ["Geist_500Medium"],
        "geist-semibold": ["Geist_600SemiBold"],
        "geist-bold": ["Geist_700Bold"],
      },
      borderRadius: {
        input: '18px',
        button: '20px',
        card: '22px',
        nav: '30px',
      },
    },
  },
  plugins: [],
};
