import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  /** Shows a check mark when selected — for multi-select groups. */
  showCheck?: boolean;
  /** Dimmed and not pressable, e.g. when a pick limit is reached. */
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** A pressable, selectable pill with real button semantics and a comfortable hit area. */
export function Chip({ label, selected = false, onPress, showCheck = false, icon, disabled = false }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        !selected && pressed && styles.chipPressed,
        disabled && styles.chipDisabled,
      ]}
    >
      {showCheck && selected ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
      {icon ? <Ionicons name={icon} size={15} color={selected ? '#fff' : colors.textMuted} /> : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

/** Wrapping group of chips. */
export function ChipGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

/** Single-line, horizontally scrolling group — for long filter lists that would otherwise wrap into a wall. */
export function ChipScroller({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scrollerOuter}
      contentContainerStyle={styles.scroller}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    cursor: 'pointer',
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipPressed: {
    borderColor: colors.textMuted,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  labelSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  scrollerOuter: {
    // Never let a surrounding flex column squash the row (e.g. above a FlatList).
    flexGrow: 0,
    flexShrink: 0,
    marginHorizontal: -spacing.md,
  },
  scroller: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
