import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BountyResultScreen } from '@/components/drops/bounty-result';
import { Atmosphere } from '@/components/signal/backdrop';
import { Palette } from '@/constants/signal';
import { useDrop, useMyAward } from '@/hooks/use-drops';
import { useLinkForClaim } from '@/hooks/use-whop-account';
import { useRoom } from '@/hooks/use-signal';

export default function WinRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const drop = useDrop(id);
  const squad = drop?.me.squad ?? null;
  const award = useMyAward(squad?.code ?? null);
  const room = useRoom(squad?.code ?? null);
  const link = useLinkForClaim(squad?.code ?? null, `/drop/${id}/win`);
  const [signingIn, setSigningIn] = useState(false);
  if (drop === undefined || award === undefined || room === undefined) {
    return (
      <View style={styles.loading}>
        <Atmosphere />
        <ActivityIndicator color={Palette.paper} />
      </View>
    );
  }
  if (!drop || !squad || !award || !room) return <Redirect href={{ pathname: '/drop/[id]/race', params: { id } }} />;
  return (
    <BountyResultScreen
      award={award}
      bounty={drop.bounty}
      signingIn={signingIn}
      on={{
        onSignIn: async () => {
          setSigningIn(true);
          try {
            await link();
          } finally {
            setSigningIn(false);
          }
        },
        onContinue: () => router.push({ pathname: '/room/[code]', params: { code: squad.code, reveal: '1' } }),
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.ink },
});
