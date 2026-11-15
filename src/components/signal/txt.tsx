import { Text, type TextProps } from 'react-native';

import { Palette, Type, type TypeVariant } from '@/constants/signal';

import { useTypeScale } from './settings';

const capped: Partial<Record<TypeVariant, number>> = { hero: 1.35, code: 1.2, display: 1.6, label: 2 };

export function Txt({
  variant = 'body',
  color = Palette.paper,
  style,
  ...rest
}: TextProps & { variant?: TypeVariant; color?: string }) {
  const scale = useTypeScale();
  const base = Type[variant];
  const factor = Math.min(scale, capped[variant] ?? scale);
  return (
    <Text
      maxFontSizeMultiplier={capped[variant]}
      {...rest}
      style={[
        base,
        { color },
        factor !== 1 && { fontSize: base.fontSize * factor, lineHeight: base.lineHeight * factor },
        style,
      ]}
    />
  );
}
