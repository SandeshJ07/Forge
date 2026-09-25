import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import { colors, radii, spacing } from '@/constants/theme';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  /** Shown above the options in the open menu, and as the trigger's prefix (e.g. "Muscle"). */
  label: string;
  /** Label for the "no filter" choice, e.g. "All muscles". */
  allLabel: string;
  options: SelectOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  /** Trigger text when nothing is chosen. Defaults to "All". */
  placeholder?: string;
  /** Show `label` inside the trigger (off when the label is already shown beside it). */
  showLabel?: boolean;
}

/**
 * Dropdown for a single-choice filter. Opens as a bottom sheet on phones and a
 * centred menu on desktop web — both via Modal, so it behaves the same on
 * iOS, Android and web and never gets clipped by a scroll container.
 */
export function Select({ label, allLabel, options, value, onChange, placeholder = 'All', showLabel = true }: SelectProps) {
  const [open, setOpen] = useState(false);
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();

  const selectedLabel = options.find((o) => o.value === value)?.label;
  const isFiltered = value !== undefined;

  function choose(next: string | undefined) {
    onChange(next);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedLabel ?? allLabel}. Change filter`}
        style={({ pressed }) => [styles.trigger, isFiltered && styles.triggerActive, pressed && styles.triggerPressed]}
      >
        {showLabel ? <Text style={styles.triggerLabel}>{label}</Text> : null}
        <Text style={[styles.triggerValue, !isFiltered && !showLabel && styles.triggerPlaceholder]} numberOfLines={1}>
          {selectedLabel ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={isFiltered ? colors.text : colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType={isDesktopWeb ? 'fade' : 'slide'} onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, isDesktopWeb && styles.backdropCentered]} onPress={() => setOpen(false)}>
          {/* Inner Pressable swallows taps so touching the sheet doesn't close it. */}
          <Pressable
            style={[
              styles.sheet,
              isDesktopWeb ? styles.menu : { paddingBottom: Math.max(insets.bottom, spacing.md) },
            ]}
            onPress={() => {}}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close" hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView style={styles.optionScroll} showsVerticalScrollIndicator={false}>
              <OptionRow label={allLabel} selected={!isFiltered} onPress={() => choose(undefined)} />
              {options.map((option) => (
                <OptionRow
                  key={option.value}
                  label={option.label}
                  selected={option.value === value}
                  onPress={() => choose(option.value)}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function OptionRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
    >
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    cursor: 'pointer',
  },
  triggerActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  triggerPressed: {
    opacity: 0.8,
  },
  triggerLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  triggerValue: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  triggerPlaceholder: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropCentered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing.md,
    maxHeight: '75%',
  },
  menu: {
    width: 380,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.sm,
    maxHeight: '70%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  optionScroll: {
    paddingHorizontal: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    cursor: 'pointer',
  },
  optionSelected: {
    backgroundColor: colors.primaryMuted,
  },
  optionPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 15,
  },
  optionLabelSelected: {
    fontWeight: '700',
  },
});
