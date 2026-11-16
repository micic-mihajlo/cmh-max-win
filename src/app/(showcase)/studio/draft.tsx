import { Redirect, useLocalSearchParams } from 'expo-router';

import { LocalDraft } from '@/components/studio/local-draft';
import { sampleStudio } from '@/components/studio/sample';
import type { ChallengeTemplateId } from '@/lib/contract';

export default function LocalDraftRoute() {
  const { template } = useLocalSearchParams<{ template?: ChallengeTemplateId }>();
  if (sampleStudio || (template !== 'quick-quiz' && template !== 'mystery-aurora')) return <Redirect href="/studio/new" />;
  return <LocalDraft templateId={template} />;
}
