const plugin = require('tailwindcss/plugin');
const { light, dark } = require('./src/constants/palette');

/** Tailwind colour name → palette key. */
const TOKENS = {
  canvas: 'canvas',
  surface: 'surface',
  sunken: 'sunken',
  ink: 'ink',
  muted: 'muted',
  faint: 'faint',
  line: 'line',
  'line-strong': 'lineStrong',
  positive: 'positive',
  'positive-soft': 'positiveSoft',
  negative: 'negative',
  'negative-soft': 'negativeSoft',
  accent: 'accent',
  'accent-soft': 'accentSoft',
};

/** '#F7F7F5' → '247 247 245', the channel form `rgb(var(--x) / <alpha>)` needs. */
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
const variables = (palette) => Object.fromEntries(Object.entries(TOKENS).map(([name, key]) => [`--color-${name}`, channels(palette[key])]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Class mode: the app chooses light, dark or system itself (see use-appearance).
  darkMode: 'class',
  theme: {
    extend: {
      // Every colour class reads a CSS variable, so switching theme restyles the app.
      colors: Object.fromEntries(Object.keys(TOKENS).map((name) => [name, `rgb(var(--color-${name}) / <alpha-value>)`])),
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
  plugins: [
    // Light values on :root, dark values when the `dark` class is on the root.
    plugin(({ addBase }) => addBase({ ':root': variables(light), '.dark:root': variables(dark) })),
  ],
};
