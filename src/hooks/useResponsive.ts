import { Platform, useWindowDimensions } from 'react-native';

/** Viewport width, in px, at which desktop web gets its own layout instead of the phone-shaped one. */
export const DESKTOP_BREAKPOINT = 900;

/** Max width of the centered content column on desktop web. */
export const DESKTOP_CONTENT_MAX_WIDTH = 880;

/**
 * True only on web, at desktop-ish viewport widths. Mobile web and the native app
 * (iOS/Android) always return false, so their layout is completely unaffected.
 */
export function useIsDesktopWeb() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}

/**
 * True only on web, below the desktop breakpoint. The native app (iOS/Android)
 * always returns false — this is specifically for browser-on-a-phone layout
 * decisions (e.g. showing supporting illustrations that a native app would
 * render differently, or that aren't worth the bundle weight natively).
 */
export function useIsMobileWeb() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width < DESKTOP_BREAKPOINT;
}
