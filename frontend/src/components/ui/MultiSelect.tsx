import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import type { SelectOption } from '@/components/ui/Select';
import { colors, radii, spacing } from '@/constants/theme';

interface MultiSelectProps {
  /** Title of the open sheet, e.g. "Monday muscles". */
  label: string;
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Trigger text when nothing is picked. */
  placeholder: string;
}

/**
 * Dropdown that allows picking any number of options — checkboxes in a bottom
 * sheet (phones) or centred menu (desktop). Picks are staged and applied on
 * "Done", so closing the sheet by tapping outside discards changes.
 */
export function MultiSelect({ label, options, value, onChange, placeholder }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();

  const summary = value.map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ');

  function openSheet() {
    setDraft(value);
    setOpen(true);
  }

  function toggle(option: string) {
    setDraft((prev) => (prev.includes(option) ? prev.filter((v) => v !== option) : [...prev, option]));
  }

  function apply() {
    // Keep the options' order so "Chest, Triceps" reads the same however they were tapped.
    onChange(options.map((o) => o.value).filter((v) => draft.includes(v)));
    setOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${summary || placeholder}. Change`}
        style={({ pressed }) => [styles.trigger, value.length > 0 && styles.triggerActive, pressed && styles.triggerPressed]}
      >
        <Text style={[styles.triggerText, !value.length && styles.placeholder]} numberOfLines={1}>
          {summary || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={value.length ? colors.text : colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType={isDesktopWeb ? 'fade' : 'slide'} onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, isDesktopWeb && styles.backdropCentered]} onPress={() => setOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={[styles.sheet, isDesktopWeb ? styles.menu : { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          >
            <View style={styles.header}>
              <View style={styles.flex}>
                <Text style={styles.title}>{label}</Text>
                <Text style={styles.subtitle}>
                  {draft.length ? `${draft.length} selected` : 'Pick any — or none to let the AI decide'}
                </Text>
              </View>
              {draft.length ? (
                <Text style={styles.clear} onPress={() => setDraft([])} accessibilityRole="button">
                  Clear
                </Text>
              ) : null}
            </View>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {options.map((option) => {
                const checked = draft.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => toggle(option.value)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    style={({ pressed }) => [styles.option, checked && styles.optionChecked, pressed && styles.optionPressed]}
                  >
                    <Text style={[styles.optionLabel, checked && styles.optionLabelChecked]}>{option.label}</Text>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.footer}>
              <Button label="Done" onPress={apply} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  triggerText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  placeholder: {
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
    maxHeight: '85%',
  },
  menu: {
    width: 400,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.md,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  clear: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
  },
  list: {
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
  optionChecked: {
    backgroundColor: colors.primaryMuted,
  },
  optionPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 15,
  },
  optionLabelChecked: {
    fontWeight: '700',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
