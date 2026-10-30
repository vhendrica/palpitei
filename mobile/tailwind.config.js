/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        cardAlt: 'rgb(var(--c-card-alt) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        fg: 'rgb(var(--c-fg) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        onPrimary: 'rgb(var(--c-on-primary) / <alpha-value>)',
        header: 'rgb(var(--c-header) / <alpha-value>)',
        onHeader: 'rgb(var(--c-on-header) / <alpha-value>)',
        headerAccent: 'rgb(var(--c-header-accent) / <alpha-value>)',
        brand: 'rgb(var(--c-brand) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        gold: 'rgb(var(--c-gold) / <alpha-value>)',
      },
      fontFamily: {
        mont: ['Montserrat_400Regular'],
        'mont-md': ['Montserrat_500Medium'],
        'mont-sb': ['Montserrat_600SemiBold'],
        'mont-b': ['Montserrat_700Bold'],
        'mont-xb': ['Montserrat_800ExtraBold'],
        odds: ['Montserrat_700Bold'],
      },
    },
  },
  plugins: [],
};
