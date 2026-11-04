/**
 * Plat4mation brand (refreshed identity, December 2025).
 *
 * This file is the single source of truth for colours and fonts. The values are
 * turned into CSS variables at startup (see tokens.ts) and Tailwind utilities read
 * those variables (see index.css). To swap in the official font later, change
 * `fonts` below and the matching @fontsource import in main.tsx.
 *
 * Contrast notes (WCAG AA, 4.5:1 for body text):
 *  - white on brand red #E1292C          4.6:1
 *  - dark text #F7EFEE on night #0F0100   18:1
 *  - dark muted #C4AFAD on surface        9:1
 *  - dark subtle #9C8684 on night         5.6:1
 *  - light text #0B0B0B on white          19:1
 *  - light subtle #6E6262 on white        5.9:1
 *  - red text: #E1292C on white 4.6:1; on dark we use #FF6B6B (6.4:1 on night)
 */

export const brand = {
  red: '#E1292C',
  black: '#000000',
  night: '#0F0100',
  white: '#FFFFFF',
} as const

export const fonts = {
  heading: "'Montserrat Variable', 'Montserrat', 'Segoe UI', system-ui, sans-serif",
  body: "'Inter Variable', 'Inter', 'Segoe UI', system-ui, sans-serif",
  mono: "ui-monospace, 'Cascadia Code', 'Consolas', monospace",
} as const

type Palette = Record<string, string>

/** Semantic tokens. Keys become CSS variables named --ut-<key>. */
export const themes: { dark: Palette; light: Palette } = {
  dark: {
    bg: brand.night,
    surface: '#1A0505',
    'surface-2': '#240808',
    'surface-3': '#2F0E0C',
    overlay: 'rgba(15, 1, 0, 0.72)',
    border: '#3A1815',
    'border-strong': '#5A2723',
    text: '#F7EFEE',
    muted: '#C4AFAD',
    subtle: '#9C8684',
    accent: brand.red,
    'accent-hover': '#F03A3D',
    'accent-press': '#C21F22',
    'accent-fg': brand.white,
    'accent-text': '#FF6B6B',
    'accent-soft': 'rgba(225, 41, 44, 0.14)',
    'accent-glow': 'rgba(225, 41, 44, 0.45)',
    ring: '#FF6B6B',
    // problems (blocked / overdue): same family, but always drawn filled + striped + icon
    danger: '#FF5A4E',
    'danger-soft': 'rgba(255, 90, 78, 0.16)',
    success: '#4ADE80',
    warning: '#FBBF24',
    pattern: 'rgba(255, 255, 255, 0.035)',
    shadow: '0 1px 2px rgba(0,0,0,.5), 0 8px 24px rgba(0,0,0,.35)',
    'shadow-lift': '0 2px 4px rgba(0,0,0,.5), 0 16px 40px rgba(0,0,0,.45)',
  },
  light: {
    bg: '#F7F4F4',
    surface: brand.white,
    'surface-2': '#F4EFEF',
    'surface-3': '#EBE4E4',
    overlay: 'rgba(15, 1, 0, 0.45)',
    border: '#E5DCDC',
    'border-strong': '#CFC2C2',
    text: '#0B0B0B',
    muted: '#4A4040',
    subtle: '#6E6262',
    accent: brand.red,
    'accent-hover': '#C92326',
    'accent-press': '#A81C1F',
    'accent-fg': brand.white,
    'accent-text': '#C81E21',
    'accent-soft': 'rgba(225, 41, 44, 0.09)',
    'accent-glow': 'rgba(225, 41, 44, 0.30)',
    ring: brand.red,
    danger: '#C81E21',
    'danger-soft': 'rgba(200, 30, 33, 0.10)',
    success: '#15803D',
    warning: '#B45309',
    pattern: 'rgba(0, 0, 0, 0.045)',
    shadow: '0 1px 2px rgba(15,1,0,.06), 0 6px 20px rgba(15,1,0,.06)',
    'shadow-lift': '0 2px 4px rgba(15,1,0,.08), 0 14px 36px rgba(15,1,0,.12)',
  },
}

/**
 * Tones used for statuses, phases and customer chips. Harmonised with the brand:
 * muted, slightly warm, and none of them reuses the signature red except `red`,
 * which is reserved for Blocked / problems.
 */
export const toneNames = [
  'slate',
  'sky',
  'indigo',
  'violet',
  'teal',
  'green',
  'lime',
  'amber',
  'orange',
  'pink',
  'red',
] as const
export type Tone = (typeof toneNames)[number]

/** [foreground, background] per theme. Foregrounds pass AA on their backgrounds. */
export const tones: Record<
  Tone,
  { dark: [string, string]; light: [string, string]; solid: string }
> = {
  slate: {
    dark: ['#CBD5E1', 'rgba(148,163,184,.16)'],
    light: ['#334155', '#EEF1F5'],
    solid: '#94A3B8',
  },
  sky: {
    dark: ['#7DD3FC', 'rgba(56,189,248,.15)'],
    light: ['#075985', '#E3F3FC'],
    solid: '#38BDF8',
  },
  indigo: {
    dark: ['#A5B4FC', 'rgba(129,140,248,.16)'],
    light: ['#3730A3', '#ECEEFE'],
    solid: '#818CF8',
  },
  violet: {
    dark: ['#C4B5FD', 'rgba(167,139,250,.16)'],
    light: ['#5B21B6', '#F1ECFE'],
    solid: '#A78BFA',
  },
  teal: {
    dark: ['#5EEAD4', 'rgba(45,212,191,.14)'],
    light: ['#115E59', '#E0F6F3'],
    solid: '#2DD4BF',
  },
  green: {
    dark: ['#86EFAC', 'rgba(74,222,128,.14)'],
    light: ['#166534', '#E5F6EA'],
    solid: '#4ADE80',
  },
  lime: {
    dark: ['#BEF264', 'rgba(163,230,53,.13)'],
    light: ['#3F6212', '#EEF7DC'],
    solid: '#A3E635',
  },
  amber: {
    dark: ['#FCD34D', 'rgba(251,191,36,.14)'],
    light: ['#92400E', '#FDF3DC'],
    solid: '#FBBF24',
  },
  orange: {
    dark: ['#FDBA74', 'rgba(251,146,60,.15)'],
    light: ['#9A3412', '#FDEDE1'],
    solid: '#FB923C',
  },
  pink: {
    dark: ['#F9A8D4', 'rgba(244,114,182,.15)'],
    light: ['#9D174D', '#FCE8F2'],
    solid: '#F472B6',
  },
  red: {
    dark: ['#FF8A80', 'rgba(255,90,78,.18)'],
    light: ['#B91C1C', '#FDE6E6'],
    solid: '#FF5A4E',
  },
}

/** Colours offered for customers (chips, lane headers). */
export const customerColors = [
  '#E1292C',
  '#F97316',
  '#F59E0B',
  '#84CC16',
  '#10B981',
  '#14B8A6',
  '#0EA5E9',
  '#6366F1',
  '#8B5CF6',
  '#D946EF',
  '#EC4899',
  '#94A3B8',
] as const

/** Phase colours (bars, group headers, canvas nodes). Always shown together with the phase name. */
export const phaseTone = {
  Preparation: 'indigo',
  DEV: 'sky',
  UAT: 'teal',
  'Go-live': 'amber',
  PROD: 'violet',
  Hypercare: 'green',
} as const satisfies Record<string, Tone>
