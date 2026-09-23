import { useState, type ReactNode } from 'react';
import { Dimensions, Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { LogoMark } from '@/components/ui/Logo';
import { OnboardingProgressBar } from '@/components/OnboardingProgressBar';
import { OnboardingIllustration, type OnboardingIllustrationName } from '@/components/OnboardingIllustration';
import { saveAnthropicApiKey } from '@/api/anthropicKey';
import { addMeasurement } from '@/api/measurements';
import { useCompleteOnboarding, useUpsertUserProfile } from '@/hooks/useUserProfile';
import { useAuthStore } from '@/stores/useAuthStore';
import { useIsDesktopWeb, useIsMobileWeb, DESKTOP_CONTENT_MAX_WIDTH } from '@/hooks/useResponsive';
import type { ExperienceLevel, Gender, Goal, PlanRefreshCadence, UnitSystem } from '@/types/database';
import { colors, radii, spacing } from '@/constants/theme';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Hypertrophy' },
  { value: 'general_fitness', label: 'General fitness' },
  { value: 'endurance', label: 'Endurance' },
];
const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];
const EQUIPMENT_OPTIONS = ['Barbell', 'Dumbbell', 'Machine', 'Bodyweight', 'Kettlebell', 'Bands'];
const PLAN_CADENCES: { value: PlanRefreshCadence; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];
const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const SWIPE_DISMISS_THRESHOLD = 80;

interface OnboardingData {
  unitSystem: UnitSystem;
  gender: Gender | null;
  birthYear: string;
  height: string;
  startingWeight: string;
  goal: Goal | null;
  experienceLevel: ExperienceLevel | null;
  equipment: string[];
  includeWarmup: boolean;
  planCadence: PlanRefreshCadence;
  anthropicKey: string;
}

const INITIAL_DATA: OnboardingData = {
  unitSystem: 'metric',
  gender: null,
  birthYear: '',
  height: '',
  startingWeight: '',
  goal: null,
  experienceLevel: null,
  equipment: [],
  includeWarmup: true,
  planCadence: 'weekly',
  anthropicKey: '',
};

interface StepProps {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}

interface OnboardingStep {
  title: string;
  subtitle?: string;
  illustration: OnboardingIllustrationName;
  render: (props: StepProps) => ReactNode;
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Which units do you use?',
    illustration: 'units',
    render: ({ data, update }) => (
      <ChoiceRow
        options={[
          { value: 'metric', label: 'Metric — kg / cm' },
          { value: 'imperial', label: 'Imperial — lb / in' },
        ]}
        selected={[data.unitSystem]}
        onSelect={(v) => update('unitSystem', v as UnitSystem)}
      />
    ),
  },
  {
    title: 'A bit about you',
    subtitle: "Optional — helps the AI set sensible starting weights. Skip anything you'd rather not share.",
    illustration: 'profile',
    render: ({ data, update }) => (
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.fieldLabel}>Gender</Text>
          <ChoiceRow
            options={GENDERS}
            selected={data.gender ? [data.gender] : []}
            onSelect={(v) => update('gender', v as Gender)}
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.fieldLabel}>Birth year</Text>
          <TextField
            placeholder="e.g. 1995"
            keyboardType="number-pad"
            value={data.birthYear}
            onChangeText={(v) => update('birthYear', v)}
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.fieldLabel}>Height ({data.unitSystem === 'imperial' ? 'inches' : 'cm'})</Text>
          <TextField
            placeholder={data.unitSystem === 'imperial' ? 'e.g. 68' : 'e.g. 173'}
            keyboardType="decimal-pad"
            value={data.height}
            onChangeText={(v) => update('height', v)}
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.fieldLabel}>Current weight ({data.unitSystem === 'imperial' ? 'lb' : 'kg'})</Text>
          <TextField
            placeholder={data.unitSystem === 'imperial' ? 'e.g. 154' : 'e.g. 70'}
            keyboardType="decimal-pad"
            value={data.startingWeight}
            onChangeText={(v) => update('startingWeight', v)}
          />
        </View>
      </View>
    ),
  },
  {
    title: "What's your main goal?",
    illustration: 'goal',
    render: ({ data, update }) => (
      <ChoiceRow options={GOALS} selected={data.goal ? [data.goal] : []} onSelect={(v) => update('goal', v as Goal)} />
    ),
  },
  {
    title: 'How experienced are you?',
    illustration: 'experience',
    render: ({ data, update }) => (
      <ChoiceRow
        options={EXPERIENCE_LEVELS}
        selected={data.experienceLevel ? [data.experienceLevel] : []}
        onSelect={(v) => update('experienceLevel', v as ExperienceLevel)}
      />
    ),
  },
  {
    title: 'What equipment do you have?',
    subtitle: 'Pick as many as apply.',
    illustration: 'equipment',
    render: ({ data, update }) => (
      <ChoiceRow
        options={EQUIPMENT_OPTIONS.map((e) => ({ value: e.toLowerCase(), label: e }))}
        selected={data.equipment}
        multi
        onSelect={(v) =>
          update('equipment', data.equipment.includes(v) ? data.equipment.filter((e) => e !== v) : [...data.equipment, v])
        }
      />
    ),
  },
  {
    title: 'How should your plans work?',
    illustration: 'schedule',
    render: ({ data, update }) => (
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.fieldLabel}>Warm-ups</Text>
          <ChoiceRow
            options={[
              { value: 'yes', label: 'Include a warm-up' },
              { value: 'no', label: 'Skip warm-ups' },
            ]}
            selected={[data.includeWarmup ? 'yes' : 'no']}
            onSelect={(v) => update('includeWarmup', v === 'yes')}
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.fieldLabel}>Remind me to refresh my plan</Text>
          <ChoiceRow
            options={PLAN_CADENCES}
            selected={[data.planCadence]}
            onSelect={(v) => update('planCadence', v as PlanRefreshCadence)}
          />
        </View>
      </View>
    ),
  },
  {
    title: 'Use your own Anthropic key?',
    subtitle:
      "Optional. If you add one, plan generation is billed to your own account instead of the app's shared key. You can add this later in Settings.",
    illustration: 'ai',
    render: ({ data, update }) => (
      <TextField
        placeholder="sk-ant-..."
        autoCapitalize="none"
        secureTextEntry
        value={data.anthropicKey}
        onChangeText={(v) => update('anthropicKey', v)}
      />
    ),
  },
];

export default function OnboardingScreen() {
  const userId = useAuthStore((s) => s.session?.userId);
  const upsertProfile = useUpsertUserProfile();
  const completeOnboarding = useCompleteOnboarding();
  const isDesktopWeb = useIsDesktopWeb();
  const isMobileWeb = useIsMobileWeb();

  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [finishing, setFinishing] = useState(false);

  function update<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFinish() {
    setFinishing(true);
    try {
      if (data.anthropicKey.trim()) {
        try {
          await saveAnthropicApiKey(data.anthropicKey.trim());
        } catch {
          // Non-fatal — user can retry from Settings later.
        }
      }

      const parsedBirthYear = parseInt(data.birthYear, 10);
      const parsedHeight = parseFloat(data.height);
      const heightCm = Number.isFinite(parsedHeight)
        ? data.unitSystem === 'imperial'
          ? parsedHeight * 2.54
          : parsedHeight
        : null;

      await upsertProfile.mutateAsync({
        unit_system: data.unitSystem,
        gender: data.gender,
        birth_year: Number.isFinite(parsedBirthYear) ? parsedBirthYear : null,
        height_cm: heightCm,
        goal: data.goal,
        experience_level: data.experienceLevel,
        equipment_access: data.equipment,
        include_warmup: data.includeWarmup,
        plan_refresh_cadence: data.planCadence,
      });

      const parsedWeight = parseFloat(data.startingWeight);
      if (userId && Number.isFinite(parsedWeight)) {
        await addMeasurement({
          type: 'body_weight',
          value: parsedWeight,
          unit: data.unitSystem === 'imperial' ? 'lb' : 'kg',
          date: new Date().toISOString().slice(0, 10),
        });
      }

      await completeOnboarding.mutateAsync();
    } finally {
      setFinishing(false);
    }
  }

  if (isDesktopWeb) {
    return <DesktopOnboardingForm data={data} update={update} finishing={finishing} onFinish={handleFinish} />;
  }

  return (
    <MobileOnboardingWizard
      data={data}
      update={update}
      finishing={finishing}
      onFinish={handleFinish}
      showIllustration={isMobileWeb}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Mobile (native + mobile web): one question per screen, swipeable.
// ─────────────────────────────────────────────────────────────────────────

function MobileOnboardingWizard({
  data,
  update,
  finishing,
  onFinish,
  showIllustration,
}: {
  data: OnboardingData;
  update: StepProps['update'];
  finishing: boolean;
  onFinish: () => void;
  showIllustration: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const translateX = useSharedValue(0);
  const screenWidth = Dimensions.get('window').width;

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  function goNext() {
    Keyboard.dismiss();
    if (isLastStep) {
      onFinish();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    Keyboard.dismiss();
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onUpdate((event) => {
      // Resist swiping past the first/last step instead of hard-blocking, so
      // the gesture still feels responsive at the edges.
      const atEdge = (event.translationX > 0 && isFirstStep) || (event.translationX < 0 && isLastStep);
      translateX.value = atEdge ? event.translationX * 0.25 : event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX < -SWIPE_DISMISS_THRESHOLD && !isLastStep) {
        translateX.value = withTiming(-screenWidth, { duration: 200 }, () => {
          translateX.value = 0;
          runOnJS(setStepIndex)(Math.min(stepIndex + 1, STEPS.length - 1));
        });
      } else if (event.translationX > SWIPE_DISMISS_THRESHOLD && !isFirstStep) {
        translateX.value = withTiming(screenWidth, { duration: 200 }, () => {
          translateX.value = 0;
          runOnJS(setStepIndex)(Math.max(stepIndex - 1, 0));
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const step = STEPS[stepIndex];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.wrapper}>
        <View style={styles.progressRow}>
          <OnboardingProgressBar step={stepIndex} totalSteps={STEPS.length} />
        </View>

        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.stepContainer, animatedStyle]}>
            {showIllustration ? (
              <View style={styles.illustrationWrap}>
                <OnboardingIllustration name={step.illustration} size={88} />
              </View>
            ) : null}
            <Text style={styles.title}>{step.title}</Text>
            {step.subtitle ? <Text style={styles.subtitle}>{step.subtitle}</Text> : null}
            <Card style={styles.stepCard}>{step.render({ data, update })}</Card>
          </Animated.View>
        </GestureDetector>

        <View style={styles.footer}>
          <View style={styles.footerRow}>
            {!isFirstStep ? (
              <View style={styles.footerButton}>
                <Button label="Back" variant="secondary" onPress={goBack} />
              </View>
            ) : (
              <View style={styles.footerButton} />
            )}
            <View style={styles.footerButton}>
              <Button label={isLastStep ? 'Get started' : 'Next'} onPress={goNext} loading={finishing} />
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Desktop web: one continuous scrollable form, split-panel layout matching
// the sign-in screen (brand panel + form panel), all sections stacked.
// ─────────────────────────────────────────────────────────────────────────

function DesktopOnboardingForm({
  data,
  update,
  finishing,
  onFinish,
}: {
  data: OnboardingData;
  update: StepProps['update'];
  finishing: boolean;
  onFinish: () => void;
}) {
  return (
    <View style={styles.splitRoot}>
      <View style={styles.splitPanel}>
        <LogoMark size={40} />
        <View style={styles.splitCopy}>
          <Text style={styles.splitHeadline}>Let's set up your training.</Text>
          <Text style={styles.splitBody}>
            A few quick preferences now — goal, experience, equipment — so every plan Forge generates fits how
            you actually train. Everything here can be changed later in Settings.
          </Text>
        </View>
        <Text style={styles.splitFooter}>Forge — your training, compounding.</Text>
      </View>

      <ScrollView style={styles.formPanel} contentContainerStyle={styles.formPanelContent}>
        <View style={styles.desktopForm}>
          {STEPS.map((step, index) => (
            <View key={step.title} style={styles.desktopSection}>
              <Text style={styles.desktopSectionEyebrow}>
                {index + 1} of {STEPS.length}
              </Text>
              <Text style={styles.desktopSectionTitle}>{step.title}</Text>
              {step.subtitle ? <Text style={styles.subtitle}>{step.subtitle}</Text> : null}
              <Card style={styles.stepCard}>{step.render({ data, update })}</Card>
            </View>
          ))}

          <Button label="Get started" onPress={onFinish} loading={finishing} />
        </View>
      </ScrollView>
    </View>
  );
}

function ChoiceRow({
  options,
  selected,
  onSelect,
  multi = false,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onSelect: (value: string) => void;
  multi?: boolean;
}) {
  return (
    <View style={styles.chipsRow}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <Text
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            {multi && active ? '✓ ' : ''}
            {option.label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  wrapper: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  progressRow: {
    marginBottom: spacing.lg,
  },
  stepContainer: {
    flex: 1,
    gap: spacing.sm,
  },
  illustrationWrap: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  stepCard: {
    marginTop: spacing.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    overflow: 'hidden',
  },
  chipActive: {
    color: '#fff',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  footer: {
    paddingTop: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },

  // Desktop split layout — mirrors app/(auth)/sign-in.tsx
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
  },
  formPanelContent: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  desktopForm: {
    width: '100%',
    maxWidth: DESKTOP_CONTENT_MAX_WIDTH,
    gap: spacing.xl,
  },
  desktopSection: {
    gap: spacing.xs,
  },
  desktopSectionEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  desktopSectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
});
