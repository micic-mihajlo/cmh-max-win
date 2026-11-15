import { requireOptionalNativeModule } from 'expo';

const native = requireOptionalNativeModule<{ isAppClip: boolean; promptFullApp(): Promise<void> }>('AppClip');

// True only inside the iOS App Clip target; the full app, Expo Go and web read false.
export const isAppClip = native?.isAppClip ?? false;

// Shows the App Store overlay for the full SIGNAL app. Does nothing outside the clip.
export const promptFullApp = () => native?.promptFullApp() ?? Promise.resolve();
