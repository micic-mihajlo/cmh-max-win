import { convex } from '@/lib/convex';

// The fixture studio (sample creator, drops and generated cases) ships only in EXPO_PUBLIC_MOCKS=1 bundles, or when
// there is no backend to read. Every other build runs the studio on the creator's real challenges.
export const sampleStudio = process.env.EXPO_PUBLIC_MOCKS === '1' || !convex;
