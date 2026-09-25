import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { InstallAppSheet } from '@/components/InstallAppSheet';
import { useIsMobileWeb } from '@/hooks/useResponsive';
import { dismissInstallNudge, usePwaInstall } from '@/lib/pwaInstall';
import { colors, radii, spacing } from '@/constants/theme';

/**
 * Home-screen nudge to install Forge on mobile web. Shown when the browser
 * offers a real install prompt (Android Chrome etc.) or on iOS Safari (which
 * gets instructions). Dismissible; after that, Settings → App still has the
 * install option. Never renders in native builds or once installed.
 */
export function InstallPwaPrompt() {
  const isMobileWeb = useIsMobileWeb();
  const { installed, nudgeDismissed, method, fallbackMethod, promptInstall } = usePwaInstall();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (Platform.OS !== 'web' || !isMobileWeb || installed || nudgeDismissed || method === 'manual') return null;

  const dismiss = dismissInstallNudge;

  async function handleInstall() {
    const outcome = method === 'prompt' ? await promptInstall() : 'unavailable';
    if (outcome === 'accepted') dismiss();
    else if (outcome === 'unavailable') setSheetOpen(true);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>Get the Forge app</Text>
        <Text style={styles.body}>Install it on your home screen for full-screen, one-tap access.</Text>
      </View>
      <View style={styles.actions}>
        <Button label="Install" onPress={handleInstall} />
        <Button label="Not now" variant="ghost" onPress={dismiss} />
      </View>
      <InstallAppSheet visible={sheetOpen} method={fallbackMethod} onClose={() => setSheetOpen(false)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderColor: colors.primaryMuted,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    minWidth: 180,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginLeft: 'auto',
  },
});
