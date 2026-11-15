import { Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';

import { Screen, showcase } from './kit';

export class LiveBoundary extends Component<{ title?: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Live showcase screen fell back to empty state', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Screen title={this.props.title}>
        <View style={[showcase.gutter, styles.empty]}>
          <Txt variant="body" color={Palette.paperMuted} style={styles.center}>
            Nothing live right now
          </Txt>
        </View>
      </Screen>
    );
  }
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', marginTop: Space.xxxl * 3 },
  center: { textAlign: 'center' },
});
