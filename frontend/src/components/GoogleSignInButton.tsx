import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import Svg, { Path } from 'react-native-svg';
import { signInWithGoogle } from '@/api/auth';
import { ApiError } from '@/lib/apiClient';
import { colors, radii, spacing } from '@/constants/theme';

const CLIENT_IDS = {
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};

/** Whether Google sign-in is configured for the platform this build runs on. */
export const googleSignInAvailable = Boolean(
  Platform.select({ web: CLIENT_IDS.web, ios: CLIENT_IDS.ios, android: CLIENT_IDS.android, default: undefined })
);

interface Props {
  onError: (message: string) => void;
  /** Clears any previous error/info banner when the user starts again. */
  onStart?: () => void;
}

/**
 * "Continue with Google". Renders nothing unless this platform's client ID is
 * set (the underlying hook throws without one). Success signs the user in;
 * the root layout then routes to onboarding or Home as usual.
 */
export function GoogleSignInButton(props: Props) {
  return googleSignInAvailable ? <GoogleButton {...props} /> : null;
}

function GoogleButton({ onError, onStart }: Props) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: CLIENT_IDS.web,
    iosClientId: CLIENT_IDS.ios,
    androidClientId: CLIENT_IDS.android,
    selectAccount: true,
  });
  const [busy, setBusy] = useState(false);
  // Each Google result is exchanged once, even if the parent re-renders with a new onError.
  const handled = useRef<typeof response>(null);

  useEffect(() => {
    if (!response || handled.current === response) return;
    handled.current = response;
    if (response.type === 'success') {
      const idToken = response.params.id_token;
      if (!idToken) {
        setBusy(false);
        onError('Google sign-in failed. Please try again.');
        return;
      }
      signInWithGoogle(idToken)
        .catch((err) => onError(err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.'))
        .finally(() => setBusy(false));
    } else {
      setBusy(false);
      if (response.type === 'error') onError(response.error?.message ?? 'Google sign-in failed. Please try again.');
      // 'cancel' / 'dismiss': the user closed the Google window — nothing to report.
    }
  }, [response, onError]);

  return (
    <Pressable
      onPress={() => {
        onStart?.();
        setBusy(true);
        promptAsync().catch(() => setBusy(false));
      }}
      disabled={!request || busy}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      style={({ pressed }) => [styles.button, (!request || busy) && styles.disabled, pressed && styles.pressed]}
    >
      {busy ? <ActivityIndicator color="#1F1F1F" /> : <GoogleLogo />}
      <Text style={styles.label}>Continue with Google</Text>
    </Pressable>
  );
}

/** Google's four-colour "G", per their sign-in branding guidelines. */
function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm + 2,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#747775',
    cursor: 'pointer',
  },
  label: {
    color: '#1F1F1F',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
});
