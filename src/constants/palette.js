/**
 * Raw colour tokens for both themes. Shared by tailwind.config.js (CommonJS),
 * which turns them into CSS variables for classes like `bg-canvas`, and by
 * the typed theme in theme.ts for colours set in code. Keep this file
 * dependency-free.
 */
const light = {
  canvas: '#F7F7F5',
  surface: '#FFFFFF',
  sunken: '#F0F0EC',
  ink: '#111111',
  muted: '#6F6F6B',
  faint: '#9C9C97',
  line: '#E7E7E3',
  lineStrong: '#D6D6D1',
  positive: '#2E7A57',
  positiveSoft: '#E7F1EB',
  negative: '#C2543F',
  negativeSoft: '#F7E8E3',
  accent: '#C9A15B',
  accentSoft: '#F4ECDD',
  overlay: 'rgba(17,17,17,0.32)',
  // Brand colours (October 2026), added alongside the colours above. Fills
  // take brandInk on cyan and yellow, brandPaper on blue, red and green.
  brandCyan: '#4ED2D4',
  brandBlue: '#1859C3',
  brandYellow: '#F4E04D',
  brandRed: '#FF4242',
  brandGreen: '#029950',
  brandInk: '#0F0F0C',
  brandPaper: '#FFFEFA',
  brandCyanSoft: '#D8F4F4',
  brandBlueSoft: '#DCE6F7',
  brandYellowSoft: '#FBF5CC',
  brandRedSoft: '#FFE0E0',
  brandGreenSoft: '#D5EFE2',
};

/**
 * The same calm ledger after dark: warm near-black paper, cards a step
 * lighter, ink turned to warm white. Money colours are lifted so they keep
 * at least 4.5:1 contrast on cards.
 */
const dark = {
  canvas: '#111110',
  surface: '#1B1B19',
  sunken: '#242421',
  ink: '#F2F2EE',
  muted: '#A6A6A0',
  faint: '#76766F',
  line: '#2C2C29',
  lineStrong: '#3C3C38',
  positive: '#5DB38A',
  positiveSoft: '#17291F',
  negative: '#E47D64',
  negativeSoft: '#301C17',
  accent: '#D4AF6A',
  accentSoft: '#2E2719',
  overlay: 'rgba(0,0,0,0.6)',
  brandCyan: '#4ED2D4',
  brandBlue: '#1859C3',
  brandYellow: '#F4E04D',
  brandRed: '#FF4242',
  brandGreen: '#029950',
  brandInk: '#0F0F0C',
  brandPaper: '#FFFEFA',
  brandCyanSoft: '#143536',
  brandBlueSoft: '#172440',
  brandYellowSoft: '#34301A',
  brandRedSoft: '#3D1D1D',
  brandGreenSoft: '#12301F',
};

module.exports = { light, dark };
