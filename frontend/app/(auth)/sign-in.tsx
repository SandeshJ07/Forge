import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  requestPasswordReset,
  resendVerificationCode,
  resetPassword,
  signIn,
  signUp,
  verifyEmail,
} from '@/api/auth';
import { ApiError } from '@/lib/apiClient';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { PhotoBackdrop } from '@/components/ui/PhotoBackdrop';
import { InstallNudge } from '@/components/InstallNudge';
import { GoogleSignInButton, googleSignInAvailable } from '@/components/GoogleSignInButton';
import { HERO_IMAGE } from '@/constants/images';
import { colors, radii, spacing } from '@/constants/theme';
import { useIsDesktopWeb } from '@/hooks/useResponsive';

type Mode = 'sign-in' | 'sign-up' | 'verify-email' | 'forgot-password' | 'reset-password';

const HEADINGS: Record<Mode, { title: string; subtitle: string }> = {
  'sign-in': { title: 'Welcome back', subtitle: 'Sign in to pick up where you left off.' },
  'sign-up': { title: 'Create your account', subtitle: 'Log your training and get plans that adapt to you.' },
  'verify-email': { title: 'Check your email', subtitle: 'Enter the 6-digit code we sent to finish signing up.' },
  'forgot-password': {
    title: 'Reset your password',
    subtitle: "Enter your account email and we'll send you a 6-digit code.",
  },
  'reset-password': { title: 'Choose a new password', subtitle: 'Enter the code from your email and a new password.' },
};

const MOTIVATION_HEADLINE = 'The weight room keeps no secrets.';
const MOTIVATION_BODY =
  'Every rep you log becomes data your plan uses next time — what to push, what to hold, what to change.';

export default function SignInScreen() {
  const isDesktopWeb = useIsDesktopWeb();
  const [mode, setMode] = useState<Mode>('sign-in');

  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleGoogleError = useCallback((message: string) => setErrorMessage(message), []);

  // Google first, then the email/password form, on both sign-in and sign-up.
  const googleOption = googleSignInAvailable ? (
    <>
      <GoogleSignInButton onError={handleGoogleError} onStart={resetMessages} />
      <OrDivider />
    </>
  ) : null;

  function resetMessages() {
    setErrorMessage(null);
    setInfoMessage(null);
  }

  async function withLoading(fn: () => Promise<void>) {
    resetMessages();
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    resetMessages();
    setLoading(true);
    try {
      await signIn(identifier.trim(), password);
    } catch (err) {
      // Unverified account signing in with their email: take them straight to the
      // code screen instead of leaving them at a dead-end error.
      if (err instanceof ApiError && err.status === 403 && identifier.includes('@')) {
        setEmail(identifier.trim());
        setMode('verify-email');
        setInfoMessage(`Your email isn't verified yet. Enter the code we sent to ${identifier.trim()}, or resend it.`);
      } else {
        setErrorMessage(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    await withLoading(async () => {
      await signUp(email.trim(), username.trim(), password);
      setMode('verify-email');
      setInfoMessage(`We sent a 6-digit code to ${email.trim()}.`);
    });
  }

  async function handleVerifyEmail() {
    await withLoading(() => verifyEmail(email.trim(), code));
  }

  async function handleResendCode() {
    await withLoading(async () => {
      await resendVerificationCode(email.trim());
      setInfoMessage('New code sent. Check your inbox (and spam folder).');
    });
  }

  async function handleForgotPassword() {
    await withLoading(async () => {
      await requestPasswordReset(email.trim());
      setMode('reset-password');
      setInfoMessage(`If ${email.trim()} has an account, a reset code is on its way.`);
    });
  }

  async function handleResetPassword() {
    await withLoading(() => resetPassword(email.trim(), code, newPassword));
  }

  function switchMode(next: Mode) {
    resetMessages();
    setCode('');
    setMode(next);
  }

  const heading = HEADINGS[mode];

  const form = (
    <View style={styles.form}>
      {!isDesktopWeb ? (
        <View style={styles.mobileLogo}>
          <Logo size={36} textSize={26} />
        </View>
      ) : null}

      <View style={styles.headingBlock}>
        <Text style={styles.title} accessibilityRole="header">
          {heading.title}
        </Text>
        <Text style={styles.subtitle}>{heading.subtitle}</Text>
      </View>

      {errorMessage ? <Banner tone="error" message={errorMessage} /> : null}
      {infoMessage ? <Banner tone="info" message={infoMessage} /> : null}

      {mode === 'sign-in' && (
        <>
          {googleOption}
          <TextField
            label="Username or email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="sam_lifts or sam@example.com"
          />
          <View style={styles.passwordBlock}>
            <TextField
              label="Password"
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSignIn}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
            />
            <Text style={styles.inlineLink} onPress={() => switchMode('forgot-password')} accessibilityRole="link">
              Forgot password?
            </Text>
          </View>
          <Button
            label="Sign in"
            onPress={handleSignIn}
            loading={loading}
            disabled={!identifier.trim() || !password}
          />
          <SwitchPrompt prompt="New to Forge?" action="Create an account" onPress={() => switchMode('sign-up')} />
        </>
      )}

      {mode === 'sign-up' && (
        <>
          {googleOption}
          <TextField
            label="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            placeholder="sam@example.com"
          />
          <TextField
            label="Username"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
            value={username}
            onChangeText={setUsername}
            placeholder="3–30 letters, numbers or _"
          />
          <TextField
            label="Password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSignUp}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
          />
          <Button
            label="Create account"
            onPress={handleSignUp}
            loading={loading}
            disabled={!email.trim() || !username.trim() || !password}
          />
          <SwitchPrompt prompt="Already have an account?" action="Sign in" onPress={() => switchMode('sign-in')} />
        </>
      )}

      {mode === 'verify-email' && (
        <>
          <TextField
            label="6-digit code"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            returnKeyType="go"
            onSubmitEditing={handleVerifyEmail}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
            placeholder="123456"
            style={styles.codeInput}
          />
          <Button label="Verify email" onPress={handleVerifyEmail} loading={loading} disabled={code.length !== 6} />
          <View style={styles.linkRow}>
            <Text style={styles.inlineLinkCenter} onPress={loading ? undefined : handleResendCode} accessibilityRole="link">
              Resend code
            </Text>
            <Text style={styles.linkDivider}>·</Text>
            <Text style={styles.inlineLinkCenter} onPress={() => switchMode('sign-up')} accessibilityRole="link">
              Use a different email
            </Text>
          </View>
        </>
      )}

      {mode === 'forgot-password' && (
        <>
          <TextField
            label="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={handleForgotPassword}
            value={email}
            onChangeText={setEmail}
            placeholder="sam@example.com"
          />
          <Button label="Send reset code" onPress={handleForgotPassword} loading={loading} disabled={!email.trim()} />
          <SwitchPrompt prompt="Remembered it?" action="Back to sign in" onPress={() => switchMode('sign-in')} />
        </>
      )}

      {mode === 'reset-password' && (
        <>
          <TextField
            label="6-digit code"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
            placeholder="123456"
            style={styles.codeInput}
          />
          <TextField
            label="New password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleResetPassword}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 6 characters"
          />
          <Button
            label="Reset password"
            onPress={handleResetPassword}
            loading={loading}
            disabled={code.length !== 6 || !newPassword}
          />
          <SwitchPrompt prompt="Remembered it?" action="Back to sign in" onPress={() => switchMode('sign-in')} />
        </>
      )}
    </View>
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.splitRoot}>
        <PhotoBackdrop source={HERO_IMAGE} fade="full" style={styles.splitPanel}>
          <View style={styles.splitInner}>
            <Logo size={30} textSize={22} />
            <View style={styles.splitCopy}>
              <Text style={styles.splitHeadline}>{MOTIVATION_HEADLINE}</Text>
              <Text style={styles.splitBody}>{MOTIVATION_BODY}</Text>
            </View>
          </View>
        </PhotoBackdrop>
        <ScrollView
          style={styles.formPanel}
          contentContainerStyle={styles.formPanelContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formPanelInner}>{form}</View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.mobileScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {form}
        </ScrollView>
      </KeyboardAvoidingView>
      <InstallNudge />
    </SafeAreaView>
  );
}

function Banner({ tone, message }: { tone: 'error' | 'info'; message: string }) {
  const isError = tone === 'error';
  return (
    <View style={[styles.banner, isError ? styles.bannerError : styles.bannerInfo]} accessibilityLiveRegion="polite">
      <Ionicons
        name={isError ? 'alert-circle' : 'mail-outline'}
        size={18}
        color={isError ? colors.danger : colors.success}
      />
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

function OrDivider() {
  return (
    <View style={styles.orRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.orLine} />
      <Text style={styles.orText}>or</Text>
      <View style={styles.orLine} />
    </View>
  );
}

function SwitchPrompt({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  return (
    <Text style={styles.switchPrompt}>
      {prompt}{' '}
      <Text style={styles.switchAction} onPress={onPress} accessibilityRole="link">
        {action}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mobileScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  mobileLogo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  form: {
    gap: spacing.md,
  },
  headingBlock: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  passwordBlock: {
    gap: spacing.sm,
  },
  inlineLink: {
    alignSelf: 'flex-end',
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  inlineLinkCenter: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
  },
  linkDivider: {
    color: colors.textMuted,
  },
  codeInput: {
    fontSize: 22,
    letterSpacing: 8,
    fontWeight: '700',
  },
  switchPrompt: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  switchAction: {
    color: colors.primary,
    fontWeight: '700',
    cursor: 'pointer',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  bannerError: {
    backgroundColor: 'rgba(255,92,92,0.08)',
    borderColor: 'rgba(255,92,92,0.35)',
  },
  bannerInfo: {
    backgroundColor: 'rgba(61,220,132,0.08)',
    borderColor: 'rgba(61,220,132,0.35)',
  },
  bannerText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },

  // Desktop split layout
  splitRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  splitPanel: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  splitInner: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  splitCopy: {
    gap: spacing.md,
  },
  splitHeadline: {
    color: colors.text,
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 46,
    maxWidth: 520,
  },
  splitBody: {
    color: colors.text,
    opacity: 0.85,
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 440,
  },
  formPanel: {
    flex: 1,
  },
  formPanelContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  formPanelInner: {
    width: '100%',
    maxWidth: 400,
  },
});
