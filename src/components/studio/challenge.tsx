import { StudioScreen } from '@/components/showcase/studio-ui';
import { useChallengeDraft } from '@/hooks/use-challenges';

import { DraftEditor } from './editor';
import { Published } from './published';

// One address per challenge: the editor while it's a draft, then its code and link.
export function StudioChallenge({ id }: { id: string }) {
  const draft = useChallengeDraft(id);
  if (draft === undefined) return <StudioScreen title="">{null}</StudioScreen>;
  if (draft === null) return <StudioScreen title="Not found">{null}</StudioScreen>;
  if (draft.status === 'draft') return <DraftEditor key={draft.challengeId} draft={draft} />;
  return <Published c={draft} />;
}
