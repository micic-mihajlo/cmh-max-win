import { Redirect } from 'expo-router';

import { sampleStudio } from '@/components/studio/sample';
import { TemplatePicker } from '@/components/studio/template-picker';

export default function NewChallengeRoute() {
  return sampleStudio ? <Redirect href="/studio/builder?fresh=1" /> : <TemplatePicker />;
}
