import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import type { InstallMethod } from '@/lib/pwaInstall';
import { colors, radii, spacing } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const STEPS: Record<Exclude<InstallMethod, 'prompt'>, { icon: IconName; text: string }[]> = {
  ios: [
    { icon: 'share-outline', text: 'Tap the Share button in Safari’s toolbar.' },
    { icon: 'add-circle-outline', text: 'Scroll down and tap “Add to Home Screen”.' },
    { icon: 'checkmark-circle-outline', text: 'Tap “Add” — Forge appears on your home screen.' },
  ],
  manual: [
    { icon: 'ellipsis-vertical', text: 'Open your browser’s menu (⋮ or ⋯).' },
    { icon: 'download-outline', text: 'Tap “Install app” or “Add to Home screen”.' },
    { icon: 'checkmark-circle-outline', text: 'Confirm — Forge opens full-screen like a regular app.' },
  ],
};

/** Step-by-step install instructions for browsers without a one-tap install prompt (iOS Safari, Firefox, …). */
export function InstallAppSheet({
  visible,
  method,
  onClose,
}: {
  visible: boolean;
  method: Exclude<InstallMethod, 'prompt'>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Install Forge</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            {method === 'ios'
              ? 'Add Forge to your home screen for full-screen, one-tap access. This works in Safari.'
              : 'Add Forge to your home screen for full-screen, one-tap access.'}
          </Text>
          {STEPS[method].map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepIcon}>
                <Ionicons name={step.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.stepText}>
                <Text style={styles.stepNumber}>{i + 1}. </Text>
                {step.text}
              </Text>
            </View>
          ))}
          <Button label="Got it" variant="secondary" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  stepNumber: {
    fontWeight: '800',
  },
});
