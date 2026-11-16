import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { useSignOutWhop, useWhopAccount } from '@/hooks/use-whop-account';
import { feedFixtures } from '@/mocks/showcase/feed-load';
import { PressScale } from '@/motion';

import { Avatar, Section, TextAction, showcase } from './kit';

export type AccountView = { username: string | null; displayName: string; avatarUrl: string | null };

export function AccountSection({
  account,
  onSignIn,
  onSignOut,
}: {
  account: AccountView | null;
  onSignIn?: () => void;
  onSignOut: () => void;
}) {
  if (!account && !onSignIn) return null;
  return (
    <Section title="Account">
      {account ? (
        <View style={showcase.row}>
          <Avatar initials={account.displayName.slice(0, 1)} uri={account.avatarUrl ?? undefined} size={44} />
          <View style={showcase.flex}>
            <Txt variant="bodyStrong" numberOfLines={1}>
              {account.displayName}
            </Txt>
            {account.username ? (
              <Txt variant="caption" color={Palette.paperMuted} numberOfLines={1}>
                @{account.username}
              </Txt>
            ) : null}
          </View>
          <TextAction title="Sign out" muted onPress={onSignOut} />
        </View>
      ) : (
        <PressScale accessibilityRole="button" scaleTo={0.98} haptic="tap" onPress={onSignIn} style={showcase.row}>
          <View style={showcase.flex}>
            <Txt variant="bodyStrong">Sign in with Whop</Txt>
            <Txt variant="caption" color={Palette.paperMuted}>
              Keep your follows and history on every device
            </Txt>
          </View>
          <Txt variant="name" color={Palette.paperMuted} style={styles.chevron}>
            ›
          </Txt>
        </PressScale>
      )}
    </Section>
  );
}

const sampleAccount: AccountView = { displayName: 'Chris Walker', username: 'chris', avatarUrl: null };

export function Account() {
  return feedFixtures ? <SampleAccount /> : <LiveAccount />;
}

function SampleAccount() {
  const [account, setAccount] = useState<AccountView | null>(null);
  return <AccountSection account={account} onSignIn={() => setAccount(sampleAccount)} onSignOut={() => setAccount(null)} />;
}

function LiveAccount() {
  const state = useWhopAccount();
  const signOut = useSignOutWhop();
  const a = state?.available ? state.account : null;
  if (!a) return null;
  return <AccountSection account={{ displayName: a.name, username: a.username, avatarUrl: a.avatarUrl }} onSignOut={() => void signOut()} />;
}

const styles = StyleSheet.create({
  chevron: { marginLeft: Space.s },
});
