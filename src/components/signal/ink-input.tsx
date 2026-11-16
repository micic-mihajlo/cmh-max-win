import { useState } from 'react';
import { StyleSheet, TextInput, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';

import { Palette } from '@/constants/signal';

// Every visible text field: ink caret and selection instead of the iOS system blue, plus an optional focused style
// (studio fields use a 1.5pt ink border, reserved as transparent so focusing doesn't move the layout). The browser's
// focus outline is off on web; the caret and each field's own border show focus.
export function InkInput({ style, focusedStyle, onFocus, onBlur, ...props }: TextInputProps & { focusedStyle?: StyleProp<TextStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      selectionColor={Palette.paper}
      cursorColor={Palette.paper}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[styles.input, style, focused && focusedStyle]}
    />
  );
}

const styles = StyleSheet.create({ input: { outlineWidth: 0, outlineColor: 'transparent' } });
