import type { TextStyle } from 'react-native';

export const Palette = {
  ink: '#FAFAF7',
  inkDeep: '#EFEDE7',
  panel: '#FFFFFF',
  panelRaised: '#FFFFFF',
  hairline: '#E8E6E0',
  paper: '#161513',
  paperShade: '#F1EFEA',
  paperMuted: '#6B6860',
  paperFaint: '#6B6860',
  card: '#FFFFFF',
  onAccent: '#FFFFFF',
  accentSoft: '#F3EDE0',
  disabledText: '#A8A49B',
  conceptBorder: '#C9C5BC',
  inkOnPaper: '#161513',
  inkOnPaperBody: '#161513',
  inkOnPaperTime: '#6B6760',
  inkOnPaperMuted: '#6B6760',
  ember: '#E24C1A',
  emberDeep: '#D97A2B',
  danger: '#C4472F',
  ok: '#3F7A45',
} as const;

export const RoleColors = {
  detective: '#161513',
  hacker: '#161513',
  witness: '#161513',
} as const;

export const RoleInk = {
  detective: '#161513',
  hacker: '#161513',
  witness: '#161513',
} as const;

export const EmberInk = '#161513';

export const RoleMeta = {
  detective: { label: 'Detective', color: RoleColors.detective, ink: RoleInk.detective, docLabel: 'SCENE NOTES', glyph: 'D' },
  hacker: { label: 'Hacker', color: RoleColors.hacker, ink: RoleInk.hacker, docLabel: 'SYSTEMS LOG', glyph: 'H' },
  witness: { label: 'Witness', color: RoleColors.witness, ink: RoleInk.witness, docLabel: 'STATEMENT', glyph: 'W' },
} as const;

export const RoleOrder = ['detective', 'hacker', 'witness'] as const;

export const FontFamily = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  serif: 'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemi: 'Inter_600SemiBold',
  uiBold: 'Inter_700Bold',
} as const;

export const Space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const Radius = { s: 8, m: 16, l: 20, xl: 24, pill: 999 } as const;

export const Type = {
  hero: { fontFamily: FontFamily.displayBold, fontSize: 64, lineHeight: 64, letterSpacing: -2 },
  display: { fontFamily: FontFamily.displayBold, fontSize: 44, lineHeight: 48, letterSpacing: -1.1 },
  title: { fontFamily: FontFamily.displayBold, fontSize: 32, lineHeight: 40, letterSpacing: -0.6 },
  name: { fontFamily: FontFamily.display, fontSize: 20, lineHeight: 26 },
  quote: { fontFamily: FontFamily.serif, fontSize: 24, lineHeight: 32, letterSpacing: -0.2 },
  serif: { fontFamily: FontFamily.serif, fontSize: 20, lineHeight: 28 },
  body: { fontFamily: FontFamily.ui, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: FontFamily.uiSemi, fontSize: 17, lineHeight: 24 },
  evidence: { fontFamily: FontFamily.ui, fontSize: 17, lineHeight: 26 },
  evidenceItalic: { fontFamily: FontFamily.ui, fontStyle: 'italic', fontSize: 17, lineHeight: 26 },
  small: { fontFamily: FontFamily.ui, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: FontFamily.ui, fontSize: 13, lineHeight: 17 },
  smallStrong: { fontFamily: FontFamily.uiSemi, fontSize: 15, lineHeight: 20 },
  label: { fontFamily: FontFamily.uiMedium, fontSize: 15, lineHeight: 20 },
  time: { fontFamily: FontFamily.uiMedium, fontSize: 15, lineHeight: 26, fontVariant: ['tabular-nums'] },
  code: { fontFamily: FontFamily.uiBold, fontSize: 36, lineHeight: 44, fontVariant: ['tabular-nums'] },
  button: { fontFamily: FontFamily.uiSemi, fontSize: 17, lineHeight: 22 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof Type;
