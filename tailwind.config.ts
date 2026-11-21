import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './splash.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--bg-canvas-rgb) / <alpha-value>)',
        sidebar: 'rgb(var(--bg-sidebar-rgb) / <alpha-value>)',
        surface: 'rgb(var(--bg-card-rgb) / <alpha-value>)',
        raised: 'rgb(var(--bg-raised-rgb) / <alpha-value>)',
        subtle: 'rgb(var(--bg-subtle-rgb) / <alpha-value>)',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        'ink-secondary': 'rgb(var(--ink-secondary-rgb) / <alpha-value>)',
        'ink-muted': 'rgb(var(--ink-muted-rgb) / <alpha-value>)',
        hairline: 'var(--border-hairline)',
        'hairline-strong': 'var(--border-strong)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        'accent-hover': 'rgb(var(--accent-hover-rgb) / <alpha-value>)',
        'accent-ink': 'rgb(var(--accent-ink-rgb) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg-rgb) / <alpha-value>)',
        positive: 'rgb(var(--positive-rgb) / <alpha-value>)',
        negative: 'rgb(var(--negative-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        brand: {
          gold: 'rgb(var(--accent-rgb) / <alpha-value>)',
          'gold-hover': 'rgb(var(--accent-hover-rgb) / <alpha-value>)',
          'gold-light': 'rgb(var(--accent-hover-rgb) / <alpha-value>)',
          'gold-muted': 'rgb(var(--accent-rgb) / 0.14)',
          black: 'rgb(var(--bg-canvas-rgb) / <alpha-value>)',
          surface: 'rgb(var(--bg-card-rgb) / <alpha-value>)',
          border: 'var(--border-hairline)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: {
        unslop: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
