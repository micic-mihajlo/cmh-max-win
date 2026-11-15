import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { JoinCodeScreen, type JoinPhase } from '@/components/drops/join-code';
import { NameEntryScreen } from '@/components/screens/name-entry';
import { useDrop, useDropByCode, useEnterDropByCode } from '@/hooks/use-drops';
import { usePlayerName } from '@/hooks/use-player-name';
import { parseJoinCode } from '@/lib/join-code';

// Phone join by code: name once, four tiles, then wait for the deal and hand off to the squad reveal.
export default function JoinRoute() {
  const { name, save } = usePlayerName();
  const params = useLocalSearchParams<{ code?: string }>();
  const initial = params.code ? parseJoinCode(params.code) : null;
  const tried = useRef(false);
  const [draft, setDraft] = useState('');
  const [code, setCode] = useState(initial ?? '');
  const [phase, setPhase] = useState<JoinPhase>('typing');
  const [dropId, setDropId] = useState<string | null>(null);
  const enter = useEnterDropByCode();
  const drop = useDrop(dropId);
  const [failed, setFailed] = useState<string | null>(null);
  const known = useDropByCode(phase === 'error' ? failed : null);

  const submit = async (full: string) => {
    if (!name) return;
    setPhase('checking');
    try {
      const r = await enter({ code: full, name });
      setDropId(r.dropId);
    } catch {
      setFailed(full);
      setPhase('error');
    }
  };

  useEffect(() => {
    if (!name || !initial || tried.current) return;
    tried.current = true;
    submit(initial);
  });

  if (name === undefined) return null;
  if (name === null) return <NameEntryScreen name={draft} onChangeName={setDraft} onContinue={() => save(draft.trim())} />;
  if (dropId && (drop?.me.squad || drop?.me.entered)) return <Redirect href={{ pathname: '/drop/[id]', params: { id: dropId } }} />;

  return (
    <JoinCodeScreen
      code={code}
      phase={dropId ? 'joined' : phase}
      name={name}
      hostName={known?.creatorName}
      onChange={(next) => {
        setCode(next);
        if (phase === 'error') setPhase('typing');
      }}
      onSubmit={submit}
    />
  );
}
