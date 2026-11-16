import { router } from 'expo-router';
import { useState } from 'react';

import { CHALLENGES } from '@/components/drops/creator-setup';
import { MIN_PLAYERS, prizeProblem, RunGameScreen, type RunGameState } from '@/components/drops/run-game';
import { NameEntryScreen } from '@/components/screens/name-entry';
import { Arrive, Pending } from '@/components/signal/backdrop';
import { useHostDrop, useRealPayoutStatus } from '@/hooks/use-drops';
import { useMyHostedDrops, useSignInToHost } from '@/hooks/use-host-account';
import { usePlayerName } from '@/hooks/use-player-name';
import { useSignOutWhop, useWhopAccount } from '@/hooks/use-whop-account';
import type { WhopSignInResult } from '@/lib/contract';
import { toSignalError } from '@/lib/signal-error';

const SIGN_IN_FAILED: Partial<Record<WhopSignInResult, string>> = {
  cancelled: 'Sign-in was cancelled. You can still host from this device.',
  unavailable: 'Whop sign-in isn’t set up here yet. You can still host from this device.',
};

// Open a hosted drop from this device; it becomes the big shared screen. The server owns the prize from here on.
export default function HostNewRoute() {
  const hostDrop = useHostDrop();
  const real = useRealPayoutStatus();
  const whop = useWhopAccount();
  const drops = useMyHostedDrops();
  const signIn = useSignInToHost('host');
  const signOut = useSignOutWhop();
  const { name, save } = usePlayerName();
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<RunGameState>({
    challenge: CHALLENGES[0],
    cents: 300,
    mode: 'real',
    minPlayers: MIN_PLAYERS,
  });
  const [opening, setOpening] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (name === undefined) return <Pending />;
  if (name === null) return <NameEntryScreen name={draft} onChangeName={setDraft} onContinue={() => save(draft.trim())} />;
  const mode = real && !real.enabled ? 'fun' : state.mode;
  const hostName = (whop?.available ? whop.account?.name : undefined) || name;
  const effective = { ...state, mode };
  return (
    <Arrive>
      <RunGameScreen
        hostName={hostName}
        state={effective}
        onChange={(next) => {
          setState(next);
          setError(null);
        }}
        real={real}
        host={{
          account: whop?.available ? whop.account : undefined,
          drops: drops ?? [],
          signingIn,
          signInError,
          onSignIn: async () => {
            setSigningIn(true);
            setSignInError(null);
            try {
              const result = await signIn();
              if (result !== 'linked') setSignInError(SIGN_IN_FAILED[result] ?? 'Whop sign-in didn’t go through. You can still host from this device.');
            } catch {
              setSignInError('Whop sign-in didn’t go through. You can still host from this device.');
            } finally {
              setSigningIn(false);
            }
          },
          onSignOut: () => signOut(),
          onReopen: (id) => router.push({ pathname: '/drop/[id]/host', params: { id } }),
        }}
        opening={opening}
        error={error}
        onOpen={
          opening || prizeProblem(effective, real)
            ? undefined
            : async () => {
                setOpening(true);
                setError(null);
                try {
                  const fun = mode === 'fun';
                  const { dropId } = await hostDrop({
                    title: state.challenge.title,
                    totalCents: fun ? 0 : state.cents,
                    winnerSlots: fun ? 3 : 1,
                    creatorName: hostName,
                    template: state.challenge.template,
                    payoutMode: fun ? 'concept' : 'real',
                    minPlayers: state.minPlayers,
                  });
                  router.replace({
                    pathname: '/drop/[id]/host',
                    params: { id: dropId },
                  });
                } catch (e) {
                  setError(toSignalError(e)?.message ?? 'That didn’t go through. Try again.');
                } finally {
                  setOpening(false);
                }
              }
        }
      />
    </Arrive>
  );
}
