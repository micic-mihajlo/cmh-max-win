import { useCreatorPage, useFollowCreator } from '@/hooks/use-discovery';

import { CreatorScreen } from './creator-screen';

export function LiveCreator({ handle }: { handle: string }) {
  const page = useCreatorPage(handle);
  const { follow, unfollow } = useFollowCreator(handle);
  return <CreatorScreen page={page} onFollow={() => void follow()} onUnfollow={() => void unfollow()} />;
}
