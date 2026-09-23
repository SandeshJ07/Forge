import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signIn, signUp } from '@/api/auth';
import { ApiError } from '@/lib/apiClient';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Logo, LogoMark } from '@/components/ui/Logo';
import { colors, spacing } from '@/constants/theme';
import { useIsDesktopWeb } from '@/hooks/useResponsive';

const MOTIVATION_LINE = 'Every set logged is a plan getting smarter.';

const MOTIVATION_HEADLINE = 'The weight room keeps no secrets.';
const MOTIVATION_BODY =
  "Every rep you log becomes data your plan uses next time — what to push, what to hold, what to change. Forge turns a training history into a training edge.";

export default function SignInScreen() {
  const isDesktopWeb = useIsDesktopWeb();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setErrorMessage(null);
    setLoading(true);
    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <View style={styles.form}>
      {!isDesktopWeb ? (
        <View style={styles.mobileHeader}>
          <Logo size={40} textSize={30} />
          <Text style={styles.mobileMotivation}>{MOTIVATION_LINE}</Text>
        </View>
      ) : null}

      <Text style={[styles.subtitle, !isDesktopWeb && styles.subtitleCentered]}>
        {mode === 'sign-in' ? 'Welcome back.' : 'Create your account.'}
      </Text>

      <TextField
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
      />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Button
        label={mode === 'sign-in' ? 'Sign in' : 'Sign up'}
        onPress={handleSubmit}
        loading={loading}
      />
      <Button
        label={mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        variant="ghost"
        onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
      />
    </View>
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.splitRoot}>
        <View style={styles.splitPanel}>
          <LogoMark size={40} />
          <View style={styles.splitCopy}>
            <Text style={styles.splitHeadline}>{MOTIVATION_HEADLINE}</Text>
            <Text style={styles.splitBody}>{MOTIVATION_BODY}</Text>
          </View>
          <Text style={styles.splitFooter}>Forge — your training, compounding.</Text>
        </View>
        <View style={styles.formPanel}>
          <View style={styles.formPanelInner}>{form}</View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.mobileRoot}>{form}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mobileRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  mobileHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  mobileMotivation: {
    color: colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Desktop split layout
  splitRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  splitPanel: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    justifyContent: 'space-between',
  },
  splitCopy: {
    gap: spacing.md,
  },
  splitHeadline: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  splitBody: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 380,
  },
  splitFooter: {
    color: colors.textMuted,
    fontSize: 13,
  },
  formPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  formPanelInner: {
    width: '100%',
    maxWidth: 380,
  },

  form: {
    gap: spacing.md,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  subtitleCentered: {
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
});
