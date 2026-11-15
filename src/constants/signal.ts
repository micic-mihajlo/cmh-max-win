import type { TextStyle } from 'react-native';

export const Palette = {
  ink: '#0E0F13',
  inkDeep: '#08090C',
  panel: '#181A21',
  panelRaised: '#20232C',
  hairline: '#2C2F3A',
  paper: '#EDE6DA',
  paperShade: '#E2D9CA',
  paperMuted: '#A9A398',
  paperFaint: '#94908A',
  inkOnPaper: '#1A1813',
  inkOnPaperBody: '#3B3A3B',
  inkOnPaperTime: '#51504F',
  inkOnPaperMuted: '#5A5650',
  ember: '#E39B5B',
  emberDeep: '#B9733A',
  danger: '#E07A6B',
  ok: '#9FC49A',
} as const;

export const RoleColors = {
  detective: '#D9B26F',
  hacker: '#86A9D6',
  witness: '#D98E7C',
} as const;

// Bright role colors are for ink backgrounds only. On Paper use the ink variants (each at least 4.6:1).
export const RoleInk = {
  detective: '#766242',
  hacker: '#526782',
  witness: '#885B52',
} as const;

export const EmberInk = '#855D3B';

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
export const Radius = { s: 6, m: 12, l: 18, xl: 28, pill: 999 } as const;

export const Type = {
  hero: { fontFamily: FontFamily.display, fontSize: 52, lineHeight: 54, letterSpacing: -1 },
  display: { fontFamily: FontFamily.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: FontFamily.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  name: { fontFamily: FontFamily.display, fontSize: 19, lineHeight: 24 },
  quote: { fontFamily: FontFamily.serifItalic, fontSize: 17, lineHeight: 27 },
  serif: { fontFamily: FontFamily.serif, fontSize: 17, lineHeight: 27 },
  body: { fontFamily: FontFamily.ui, fontSize: 16, lineHeight: 25 },
  bodyStrong: { fontFamily: FontFamily.uiSemi, fontSize: 16, lineHeight: 24 },
  evidence: { fontFamily: FontFamily.ui, fontSize: 17, lineHeight: 26 },
  evidenceItalic: { fontFamily: FontFamily.ui, fontStyle: 'italic', fontSize: 16, lineHeight: 25 },
  small: { fontFamily: FontFamily.ui, fontSize: 13, lineHeight: 19 },
  smallStrong: { fontFamily: FontFamily.uiSemi, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: FontFamily.uiSemi, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  time: { fontFamily: FontFamily.uiMedium, fontSize: 15, lineHeight: 26, fontVariant: ['tabular-nums'] },
  code: { fontFamily: FontFamily.display, fontSize: 56, lineHeight: 64, letterSpacing: 10, fontVariant: ['tabular-nums'] },
  button: { fontFamily: FontFamily.uiSemi, fontSize: 17, lineHeight: 22 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof Type;
