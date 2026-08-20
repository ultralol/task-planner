import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        surface: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        line: {
          DEFAULT: 'rgb(var(--color-line) / <alpha-value>)',
          strong: 'rgb(var(--color-line-strong) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          light: 'rgb(var(--color-accent-light) / <alpha-value>)',
          dark: 'rgb(var(--color-accent-dark) / <alpha-value>)',
        },
        clay: {
          DEFAULT: 'rgb(var(--color-clay) / <alpha-value>)',
          light: 'rgb(var(--color-clay-light) / <alpha-value>)',
        },
        done: 'rgb(var(--color-done) / <alpha-value>)',
        pending: 'rgb(var(--color-pending) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [
    // `can-hover:` — применять стиль только там, где есть настоящее наведение (мышь).
    // На тач-устройствах правило не срабатывает, поэтому кнопки действий видны всегда.
    plugin(({ addVariant }) => {
      addVariant('can-hover', '@media (hover: hover) and (pointer: fine)');
    }),
  ],
};
