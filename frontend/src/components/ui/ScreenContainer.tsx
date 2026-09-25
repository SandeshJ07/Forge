import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { DESKTOP_CONTENT_MAX_WIDTH, useIsDesktopWeb } from '@/hooks/useResponsive';

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
}

export function ScreenContainer({ scroll = true, children, style, ...rest }: ScreenContainerProps) {
  const isDesktopWeb = useIsDesktopWeb();

  const inner = <View style={[styles.column, isDesktopWeb && styles.columnDesktop, style]}>{children}</View>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, isDesktopWeb && styles.contentDesktop]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={[styles.content, isDesktopWeb && styles.contentDesktop, { flex: 1 }]} {...rest}>
          {inner}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  contentDesktop: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    gap: spacing.md,
  },
  columnDesktop: {
    maxWidth: DESKTOP_CONTENT_MAX_WIDTH,
  },
});
