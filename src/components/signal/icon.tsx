import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { Palette } from '@/constants/signal';

export function Icon({ name, size = 18, color = Palette.paper }: { name: SymbolViewProps['name']; size?: number; color?: string }) {
  return <SymbolView name={name} size={size} tintColor={color} resizeMode="scaleAspectFit" style={{ width: size, height: size }} />;
}
