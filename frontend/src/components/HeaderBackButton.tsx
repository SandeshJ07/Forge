import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';

/**
 * Stack header back button that still works when the screen was opened
 * directly (deep link, or a page refresh on web) and there's no history to
 * pop — it falls back to the screen's parent section instead of doing nothing.
 */
export function HeaderBackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={10}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
    cursor: 'pointer',
  },
  pressed: {
    opacity: 0.6,
  },
});
