import type { TextStyle } from 'react-native';

export const Palette = {
  ink: '#F9F9F8',
  inkDeep: '#F1F0EF',
  panel: '#FFFFFF',
  panelRaised: '#FFFFFF',
  hairline: '#DAD9D6',
  paper: '#21201C',
  paperShade: '#F1F0EF',
  paperMuted: '#63635E',
  paperFaint: '#63635E',
  card: '#FFFFFF',
  onAccent: '#FFFFFF',
  accentSoft: '#FFEAE4',
  disabledText: '#1915014A',
  conceptBorder: '#CFCECA',
  inkOnPaper: '#21201C',
  inkOnPaperBody: '#21201C',
  inkOnPaperTime: '#63635E',
  inkOnPaperMuted: '#63635E',
  ember: '#FA4616',
  emberDeep: '#EC3400',
  danger: '#E1000D',
  ok: '#008500',
} as const;

export const RoleColors = {
  detective: '#21201C',
  hacker: '#21201C',
  witness: '#21201C',
} as const;

export const RoleInk = {
  detective: '#21201C',
  hacker: '#21201C',
  witness: '#21201C',
} as const;

export const EmberInk = '#21201C';

export const RoleMeta = {
  detective: { label: 'Detective', color: RoleColors.detective, ink: RoleInk.detective, docLabel: 'SCENE NOTES', glyph: 'D' },
  hacker: { label: 'Hacker', color: RoleColors.hacker, ink: RoleInk.hacker, docLabel: 'SYSTEMS LOG', glyph: 'H' },
  witness: { label: 'Witness', color: RoleColors.witness, ink: RoleInk.witness, docLabel: 'STATEMENT', glyph: 'W' },
} as const;

export const RoleOrder = ['detective', 'hacker', 'witness'] as const;

export const FontFamily = {
  display: 'Inter_600SemiBold',
  displayBold: 'Inter_700Bold',
  serif: 'Inter_400Regular',
  serifItalic: 'Inter_400Regular_Italic',
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemi: 'Inter_600SemiBold',
  uiBold: 'Inter_700Bold',
} as const;

export const Space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const Radius = { s: 8, m: 16, l: 20, xl: 20, pill: 9999 } as const;

export const Type = {
  hero: { fontFamily: FontFamily.displayBold, fontSize: 64, lineHeight: 70, letterSpacing: -2.2 },
  display: { fontFamily: FontFamily.displayBold, fontSize: 48, lineHeight: 54, letterSpacing: -1.5 },
  title: { fontFamily: FontFamily.displayBold, fontSize: 32, lineHeight: 40, letterSpacing: -0.75 },
  name: { fontFamily: FontFamily.display, fontSize: 20, lineHeight: 28 },
  quote: { fontFamily: FontFamily.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
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
  code: { fontFamily: FontFamily.uiSemi, fontSize: 36, lineHeight: 44, fontVariant: ['tabular-nums'] },
  button: { fontFamily: FontFamily.uiSemi, fontSize: 17, lineHeight: 22 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof Type;
