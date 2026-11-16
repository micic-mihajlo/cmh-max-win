import { router } from 'expo-router';
import { useState } from 'react';

import { JoinScreen } from './join';
import { LobbyScreen } from './lobby';
import { BlankScreen, NoticeScreen } from './notice';
import { isQuizView } from './format';
import { PlayScreen } from './play';
import { ResultScreen } from './result';
import {
  useChallengeByCode,
  useChallengeRecap,
  useClaimPayout,
  useJoinChallenge,
  useLeaveChallenge,
  useMyPayout,
} from '@/hooks/use-challenges';
import { useLiveView, usePlayerAction, useTeamSessionView } from '@/hooks/use-live';
import { usePlayerName } from '@/hooks/use-player-name';
import { useLinkForClaim, useSignInToJoin } from '@/hooks/use-whop-account';
import { Button } from '@/components/signal/primitives';
import type { SignalErrorCode } from '@/lib/contract';
import { teamIndexFromLabel, teamStyle } from '@/lib/teams';
import { toSignalError } from '@/lib/signal-error';

type Refusal = 'members' | 'signin' | 'closed' | 'full';

const refusals: Partial<Record<SignalErrorCode | 'ENTRIES_LOCKED', Refusal>> = {
  NOT_ELIGIBLE: 'members',
  WHOP_SIGN_IN_REQUIRED: 'signin',
  CHALLENGE_CLOSED: 'closed',
  ENTRIES_LOCKED: 'closed',
  CHALLENGE_FULL: 'full',
};

// The whole player path for one join code: join, wait, play, result. A plain component so the App Clip can host it.
export function ChallengePlayer({ code: rawCode }: { code: string }) {
  const code = rawCode.trim().toUpperCase();
  const challenge = useChallengeByCode(code || null);
  const challengeId = challenge?.challengeId ?? null;
  const entered = !!challenge?.me.entered;
  const session = useTeamSessionView(entered ? challengeId : null);
  const live = useLiveView(entered ? code : null);
  const ended = challenge?.status === 'ended';
  const payout = useMyPayout(ended ? challengeId : null);
  const recap = useChallengeRecap(ended ? challengeId : null);
  const { name, save } = usePlayerName();

  const join = useJoinChallenge();
  const leave = useLeaveChallenge(challengeId ?? '');
  const act = usePlayerAction(challengeId ?? '');
  const linkWhop = useLinkForClaim(challenge?.me.team?.roomCode ?? null, `c/${code}`);
  const claim = useClaimPayout(challengeId ?? '');
  const signInToJoin = useSignInToJoin(code || null, `c/${code}`);

  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [lastName, setLastName] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  if (challenge === undefined || name === undefined) return <BlankScreen />;
  if (challenge === null) return <NoticeScreen eyebrow={code} title="No challenge with that code" />;

  const host = challenge.creator.displayName;
  const onJoin = async (playerName: string) => {
    setJoining(true);
    setJoinError(null);
    setLastName(playerName);
    try {
      await save(playerName);
      await join({ code, name: playerName });
      setRefusal(null);
    } catch (e) {
      const err = toSignalError(e);
      const kind = err ? refusals[err.code] : undefined;
      if (kind) setRefusal(kind);
      else setJoinError(err?.message ?? 'Could not join. Try again.');
    } finally {
      setJoining(false);
    }
  };
  const onSignIn = async () => {
    setSigningIn(true);
    try {
      const result = await signInToJoin();
      if (result === 'linked' || result === 'not_required') await onJoin(lastName || name || 'Player');
    } finally {
      setSigningIn(false);
    }
  };
  if (challenge.cancelled) return <NoticeScreen eyebrow={challenge.title} title="Cancelled" text={challenge.cancelled.reason || `${host} called this one off.`} />;
  if (refusal === 'members') {
    return <NoticeScreen eyebrow={challenge.title} title="Members only" text={`This challenge is for members of ${host}'s Whop.`} />;
  }
  if (refusal === 'signin' && !entered) {
    return (
      <NoticeScreen
        eyebrow={challenge.title}
        title="Members only"
        text={`Sign in with the Whop account that has ${host}'s membership.`}
        footer={<Button title={signingIn || joining ? 'Opening Whop' : 'Sign in with Whop'} disabled={signingIn || joining} onPress={onSignIn} />}
      />
    );
  }
  if (refusal === 'full') return <NoticeScreen eyebrow={challenge.title} title="It's full" text="Every seat is taken." />;

  if (!entered) {
    if (refusal === 'closed' || challenge.status !== 'published') {
      return (
        <NoticeScreen
          eyebrow={challenge.title}
          title={challenge.status === 'ended' ? 'This one has ended' : 'Entries are closed'}
          text={challenge.status === 'ended' ? undefined : `${host} already started.`}
        />
      );
    }
    return <JoinScreen challenge={challenge} initialName={name ?? ''} error={joinError} joining={joining} onJoin={onJoin} />;
  }

  const quiz = session && isQuizView(session.shared) ? session.shared : null;
  const answeredByMe = (session?.mine as { answeredByMe?: number[] } | null)?.answeredByMe ?? [];

  if (ended || quiz?.finished) {
    const onClaim = async () => {
      setClaiming(true);
      try {
        const linked = payout?.needsWhopSignIn ? await linkWhop() : 'linked';
        if (linked === 'linked') await claim();
      } catch {
      } finally {
        setClaiming(false);
      }
    };
    return (
      <ResultScreen
        title={challenge.title}
        teamLabel={session?.teamLabel ?? challenge.me.team?.label ?? null}
        solo={challenge.teamSize === 1}
        teamSize={challenge.teamSize}
        totalPoints={quiz?.points ?? null}
        ended={ended}
        teamCount={recap?.teamCount ?? null}
        leaderboard={live?.leaderboard ?? null}
        payout={payout ?? null}
        teamCents={recap?.podium.find((row) => row.teamLabel === (session?.teamLabel ?? challenge.me.team?.label))?.cents ?? null}
        conceptPool={challenge.payoutAdapter === 'concept'}
        host={host}
        claiming={claiming}
        onClaim={onClaim}
        onDone={() => router.replace('/')}
      />
    );
  }

  if (quiz && quiz.questions.length > 0 && session) {
    const onAnswer = async (questionIndex: number, choice: number) => {
      try {
        await act({ type: 'answer', questionIndex, choice });
        return null;
      } catch (e) {
        return toSignalError(e)?.message ?? 'That answer did not go through.';
      }
    };
    const team = challenge.teamSize > 1 ? teamStyle(session.teamLabel, teamIndexFromLabel(session.teamLabel)) : null;
    return <PlayScreen quiz={quiz} answeredByMe={answeredByMe} serverNow={session.serverNow} team={team} onAnswer={onAnswer} />;
  }

  const canLeave = challenge.status === 'published';
  const onLeave = async () => {
    setLeaving(true);
    try {
      await leave();
      router.replace('/');
    } finally {
      setLeaving(false);
    }
  };
  return <LobbyScreen challenge={challenge} onLeave={canLeave ? onLeave : undefined} leaving={leaving} />;
}
