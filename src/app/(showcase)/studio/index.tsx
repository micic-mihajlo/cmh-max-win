import { SampleStudioHome } from '@/components/studio/sample-home';
import { sampleStudio } from '@/components/studio/sample';
import { StudioHome } from '@/components/studio/home';

export default function StudioRoute() {
  return sampleStudio ? <SampleStudioHome /> : <StudioHome />;
}
