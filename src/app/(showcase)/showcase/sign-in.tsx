import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';

import { ClaimHandleScreen, WelcomeScreen } from '@/components/showcase/social/sign-in';

export default function SignIn() {
  const params = useLocalSearchParams<{ step?: string }>();
  const [step, setStep] = useState(params.step === 'handle' ? 'handle' : 'welcome');
  if (step === 'handle') return <ClaimHandleScreen onDone={() => router.replace('/showcase/profile' as Href)} />;
  return <WelcomeScreen onWhop={() => setStep('handle')} onApple={() => setStep('handle')} onLater={() => router.back()} />;
}
