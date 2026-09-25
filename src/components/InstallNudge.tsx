import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { InstallAppSheet } from '@/components/InstallAppSheet';
import { useIsMobileWeb } from '@/hooks/useResponsive';
import { dismissInstallNudge, usePwaInstall } from '@/lib/pwaInstall';
import { colors, radii, spacing } from '@/constants/theme';

const APP_ICON = require('../../assets/icon.png');
const SHOW_DELAY_MS = 900; // let the sign-in screen settle before sliding this up

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'flash-outline', text: 'Opens in one tap from your home screen' },
  { icon: 'expand-outline', text: 'Full screen — no browser bars in the way' },
  { icon: 'barbell-outline', text: 'Log sets faster between rounds' },
];

/**
 * First-visit install nudge for mobile web, shown on the sign-in screen.
 * Any way of closing it ("Not now", tapping outside, back button) is
 * remembered on this device — as is tapping Install — so it never nags twice.
 * The Home banner shares the same flag; Settings → App stays available.
 */
export function InstallNudge() {
  const isMobileWeb = useIsMobileWeb();
  const { installed, nudgeDismissed, method, fallbackMethod, promptInstall } = usePwaInstall();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);

  const eligible = Platform.OS === 'web' && isMobileWeb && !installed && !nudgeDismissed;

  useEffect(() => {
    if (!eligible) return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [eligible]);

  function notNow() {
    setVisible(false);
    dismissInstallNudge();
  }

  async function install() {
    setVisible(false);
    dismissInstallNudge(); // they engaged — don't show the nudge again either way
    const outcome = method === 'prompt' ? await promptInstall() : 'unavailable';
    if (outcome === 'unavailable') setStepsOpen(true);
  }

  if (Platform.OS !== 'web') return null;

  return (
    <>
      <Modal visible={visible && eligible} transparent animationType="slide" onRequestClose={notNow}>
        <Pressable style={styles.backdrop} onPress={notNow}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Image source={APP_ICON} style={styles.appIcon} />
              <View style={styles.flex}>
                <Text style={styles.title}>Get the Forge app</Text>
                <Text style={styles.subtitle}>Free · installs in seconds · no app store needed</Text>
              </View>
            </View>

            {BENEFITS.map((b) => (
              <View key={b.text} style={styles.benefit}>
                <Ionicons name={b.icon} size={18} color={colors.primary} />
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}

            <View style={styles.actions}>
              <Button label="Install app" onPress={install} />
              <Button label="Not now" variant="ghost" onPress={notNow} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <InstallAppSheet visible={stepsOpen} method={fallbackMethod} onClose={() => setStepsOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  appIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  benefitText: {
    color: colors.text,
    fontSize: 15,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
