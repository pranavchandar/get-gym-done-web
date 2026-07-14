import type { ThemeChoice } from '../types';

export function resolveTheme(theme: ThemeChoice): 'light' | 'dark' {
  if (theme === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return theme;
}

export function applyTheme(theme: ThemeChoice, accent: string): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolveTheme(theme));
  root.setAttribute('data-accent', accent);
}
