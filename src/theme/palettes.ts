export interface AccentPalette {
  key: string;
  label: string;
  primary: string;
  secondary: string;
  onAccent: string;
}

export const ACCENT_PALETTES: AccentPalette[] = [
  { key: 'lime', label: 'Electric lime', primary: '#B7EF09', secondary: '#FF5453', onAccent: '#0A0A09' },
  { key: 'ember', label: 'Ember', primary: '#FF7C00', secondary: '#F46EB4', onAccent: '#0A0A09' },
  { key: 'blue', label: 'Electric blue', primary: '#00CDFF', secondary: '#73D25D', onAccent: '#0A0A09' },
  { key: 'blood_red', label: 'Blood red', primary: '#EE343B', secondary: '#FBC600', onAccent: '#F7F5F0' },
  { key: 'violet', label: 'Violet', primary: '#9658FF', secondary: '#FBC600', onAccent: '#F7F5F0' },
  { key: 'hyper_green', label: 'Hyper green', primary: '#4DF83F', secondary: '#FF6661', onAccent: '#0A0A09' },
  { key: 'magenta', label: 'Magenta', primary: '#FF2391', secondary: '#00E2ED', onAccent: '#0A0A09' },
  { key: 'gold', label: 'Gold', primary: '#F3C530', secondary: '#EE343B', onAccent: '#0A0A09' },
  { key: 'cyan', label: 'Cyan', primary: '#1EE6E7', secondary: '#FF7C00', onAccent: '#0A0A09' },
  { key: 'mono', label: 'Mono', primary: '#F7F5F0', secondary: '#A8A59A', onAccent: '#0A0A09' },
];

export const DEFAULT_ACCENT = 'lime';

export function paletteFor(key: string): AccentPalette {
  return ACCENT_PALETTES.find((p) => p.key === key) ?? ACCENT_PALETTES[0];
}

// Fixed onboarding lime accent
export const ONBOARDING_LIME = '#C1F038';
export const ONBOARDING_BG = '#0A0A09';

// Confetti palette (lime/coral/cyan/gold/violet/magenta/green)
export const CONFETTI_COLORS = [
  '#C1F038',
  '#F76E5C',
  '#00CDFF',
  '#F3C530',
  '#9658FF',
  '#FF2391',
  '#55C46E',
];

// The 9 split options shown on PickSplit, in display order. The last is the pseudo
// "Build my own" option (id 'custom'). The rest map to seed split ids.
export interface SplitOption {
  id: string;
  badge?: string;
  /** Who it suits, in a line. */
  blurb?: string;
}

export const SPLIT_OPTIONS: SplitOption[] = [
  { id: 'toji_7day', badge: 'RECOMMENDED', blurb: 'Five days that hit everything twice, with rest built in.' },
  { id: 'ppl_6day', blurb: 'Six days a week for size; each muscle twice. For experienced lifters with the time.' },
  { id: 'upper_lower_4day', blurb: 'Four days, each muscle twice a week. A solid default for most people.' },
  { id: 'phul_4day', blurb: 'Four days mixing heavy strength days with higher-rep size days.' },
  { id: 'bro_5day', blurb: 'One muscle group a day, five days. Big pumps, each muscle once a week.' },
  { id: 'arnold_6day', blurb: 'Six days, chest with back and shoulders with arms. High volume.' },
  { id: 'glute_focused_5day', blurb: 'Five days with extra glute and hamstring work, upper body kept in.' },
  { id: 'full_body_3day', blurb: 'Three full-body days. Best for beginners or a busy week.' },
  { id: 'custom' },
];

export const CUSTOM_SPLIT_ID = 'custom';
