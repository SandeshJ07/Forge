import { useState, type ReactNode } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Logo } from '@/components/ui/Logo';
import { OptionCard } from '@/components/ui/OptionCard';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { PhotoBackdrop } from '@/components/ui/PhotoBackdrop';
import { OnboardingProgressBar } from '@/components/OnboardingProgressBar';
import { HERO_IMAGE, ONBOARDING_IMAGES, type OnboardingImageName } from '@/constants/images';
import { EQUIPMENT_OPTIONS } from '@/constants/equipment';
import { saveAiKey } from '@/api/aiKeys';
import { AI_PROVIDERS, providerInfo } from '@/constants/aiProviders';
import { addMeasurement } from '@/api/measurements';
import { useCompleteOnboarding, useUpsertUserProfile } from '@/hooks/useUserProfile';
import { useAuthStore } from '@/stores/useAuthStore';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import { ApiError } from '@/lib/apiClient';
import type { AIProvider, ExperienceLevel, Gender, Goal, PlanRefreshCadence, UnitSystem } from '@/types/database';
import { colors, spacing } from '@/constants/theme';

const UNIT_OPTIONS: { value: UnitSystem; label: string; description: string }[] = [
  { value: 'metric', label: 'Metric', description: 'Kilograms and centimetres' },
  { value: 'imperial', label: 'Imperial', description: 'Pounds and inches' },
];
const GOALS: { value: Goal; label: string; description: string }[] = [
  { value: 'strength', label: 'Strength', description: 'Lift heavier — lower reps, longer rest' },
  { value: 'hypertrophy', label: 'Build muscle', description: 'Size and shape — moderate reps, more volume' },
  { value: 'general_fitness', label: 'General fitness', description: 'Feel fitter and move better day to day' },
  { value: 'endurance', label: 'Endurance', description: 'Go longer and recover faster' },
];
const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string; description: string }[] = [
  { value: 'beginner', label: 'Beginner', description: 'New to lifting, or returning after a long break' },
  { value: 'intermediate', label: 'Intermediate', description: 'Training consistently for 1–3 years' },
  { value: 'advanced', label: 'Advanced', description: '3+ years, confident with heavy compound lifts' },
];
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

const SWIPE_THRESHOLD = 80;

interface OnboardingData {
  unitSystem: UnitSystem;
  gender: Gender | null;
  birthYear: string;
  height: string;
  startingWeight: string;
  goal: Goal | null;
  experienceLevel: ExperienceLevel | null;
  equipment: string[];
  planCadence: PlanRefreshCadence;
  aiProvider: AIProvider;
  aiKey: string;
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
  planCadence: 'weekly',
  aiProvider: 'anthropic',
  aiKey: '',
};

interface StepProps {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  /** Two-column option grids on wide layouts. */
  wide?: boolean;
}

interface OnboardingStep {
  key: string;
  title: string;
  subtitle?: string;
  image: OnboardingImageName;
  /** When true and nothing is filled in, the primary button reads "Skip for now". */
  isSkippable?: (data: OnboardingData) => boolean;
  render: (props: StepProps) => ReactNode;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function OptionList({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <View style={[styles.optionList, wide && styles.optionGrid]}>{children}</View>;
}

function OptionCell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <View style={wide ? styles.optionCellWide : undefined}>{children}</View>;
}

const STEPS: OnboardingStep[] = [
  {
    key: 'units',
    title: 'Which units do you use?',
    subtitle: 'Used for weights and body measurements everywhere in Forge.',
    image: 'units',
    render: ({ data, update, wide }) => (
      <OptionList wide={wide}>
        {UNIT_OPTIONS.map((option) => (
          <OptionCell key={option.value} wide={wide}>
            <OptionCard
              label={option.label}
              description={option.description}
              selected={data.unitSystem === option.value}
              onPress={() => update('unitSystem', option.value)}
            />
          </OptionCell>
        ))}
      </OptionList>
    ),
  },
  {
    key: 'profile',
    title: 'A bit about you',
    subtitle: "Optional — helps set sensible starting weights. Skip anything you'd rather not share.",
    image: 'profile',
    isSkippable: (d) => !d.gender && !d.birthYear && !d.height && !d.startingWeight,
    render: ({ data, update, wide }) => (
      <View style={styles.fieldStack}>
        <Field label="Gender">
          <ChipGroup>
            {GENDERS.map((g) => (
              <Chip
                key={g.value}
                label={g.label}
                selected={data.gender === g.value}
                onPress={() => update('gender', data.gender === g.value ? null : g.value)}
              />
            ))}
          </ChipGroup>
        </Field>
        <View style={[styles.fieldRow, !wide && styles.fieldRowNarrow]}>
          <View style={styles.fieldRowItem}>
            <Field label="Birth year">
              <TextField
                placeholder="1995"
                keyboardType="number-pad"
                maxLength={4}
                value={data.birthYear}
                onChangeText={(v) => update('birthYear', v.replace(/\D/g, ''))}
              />
            </Field>
          </View>
          <View style={styles.fieldRowItem}>
            <Field label={`Height (${data.unitSystem === 'imperial' ? 'in' : 'cm'})`}>
              <TextField
                placeholder={data.unitSystem === 'imperial' ? '68' : '173'}
                keyboardType="decimal-pad"
                value={data.height}
                onChangeText={(v) => update('height', v)}
              />
            </Field>
          </View>
          <View style={styles.fieldRowItem}>
            <Field label={`Weight (${data.unitSystem === 'imperial' ? 'lb' : 'kg'})`}>
              <TextField
                placeholder={data.unitSystem === 'imperial' ? '154' : '70'}
                keyboardType="decimal-pad"
                value={data.startingWeight}
                onChangeText={(v) => update('startingWeight', v)}
              />
            </Field>
          </View>
        </View>
      </View>
    ),
  },
  {
    key: 'goal',
    title: "What's your main goal?",
    subtitle: 'Your plans are built around this. You can change it any time.',
    image: 'goal',
    isSkippable: (d) => !d.goal,
    render: ({ data, update, wide }) => (
      <OptionList wide={wide}>
        {GOALS.map((option) => (
          <OptionCell key={option.value} wide={wide}>
            <OptionCard
              label={option.label}
              description={option.description}
              selected={data.goal === option.value}
              onPress={() => update('goal', option.value)}
            />
          </OptionCell>
        ))}
      </OptionList>
    ),
  },
  {
    key: 'experience',
    title: 'How experienced are you?',
    subtitle: 'So your first plan starts at the right volume.',
    image: 'experience',
    isSkippable: (d) => !d.experienceLevel,
    render: ({ data, update, wide }) => (
      <OptionList wide={wide}>
        {EXPERIENCE_LEVELS.map((option) => (
          <OptionCell key={option.value} wide={wide}>
            <OptionCard
              label={option.label}
              description={option.description}
              selected={data.experienceLevel === option.value}
              onPress={() => update('experienceLevel', option.value)}
            />
          </OptionCell>
        ))}
      </OptionList>
    ),
  },
  {
    key: 'equipment',
    title: 'What equipment do you have?',
    subtitle: 'Pick all that apply — plans only use what you can actually get to.',
    image: 'equipment',
    isSkippable: (d) => d.equipment.length === 0,
    render: ({ data, update }) => (
      <OptionList wide>
        {EQUIPMENT_OPTIONS.map(({ value, label }) => {
          const selected = data.equipment.includes(value);
          return (
            <OptionCell key={value} wide>
              <OptionCard
                multi
                label={label}
                selected={selected}
                onPress={() =>
                  update('equipment', selected ? data.equipment.filter((e) => e !== value) : [...data.equipment, value])
                }
              />
            </OptionCell>
          );
        })}
      </OptionList>
    ),
  },
  {
    key: 'schedule',
    title: 'How often do you want a fresh plan?',
    subtitle: "We'll remind you to regenerate it — plans are never replaced without you asking.",
    image: 'schedule',
    render: ({ data, update }) => (
      <View style={styles.fieldStack}>
        <Field label="Remind me every">
          <ChipGroup>
            {PLAN_CADENCES.map((c) => (
              <Chip
                key={c.value}
                label={c.label}
                selected={data.planCadence === c.value}
                onPress={() => update('planCadence', c.value)}
              />
            ))}
          </ChipGroup>
        </Field>
      </View>
    ),
  },
  {
    key: 'ai',
    title: 'Which AI should build your plans?',
    subtitle:
      "Pick a provider. Optionally add your own API key so plan generation is billed to your account instead of the app's shared key — you can do this later in Settings.",
    image: 'ai',
    isSkippable: (d) => !d.aiKey.trim(),
    render: ({ data, update, wide }) => {
      const provider = providerInfo(data.aiProvider);
      return (
        <View style={styles.fieldStack}>
          <OptionList wide={wide}>
            {AI_PROVIDERS.map((p) => (
              <OptionCell key={p.value} wide={wide}>
                <OptionCard
                  label={p.name}
                  description={`by ${p.company}`}
                  selected={data.aiProvider === p.value}
                  onPress={() => update('aiProvider', p.value)}
                />
              </OptionCell>
            ))}
          </OptionList>
          <Field label={`Your ${provider.name} API key (optional)`}>
            <TextField
              placeholder={provider.keyPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={data.aiKey}
              onChangeText={(v) => update('aiKey', v)}
            />
            <Text style={styles.hint}>{provider.keyHelp}</Text>
          </Field>
        </View>
      );
    },
  },
];

export default function OnboardingScreen() {
  const userId = useAuthStore((s) => s.session?.userId);
  const username = useAuthStore((s) => s.session?.username);
  const upsertProfile = useUpsertUserProfile();
  const completeOnboarding = useCompleteOnboarding();
  const isDesktopWeb = useIsDesktopWeb();

  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [finishing, setFinishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function update<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFinish() {
    setErrorMessage(null);
    setFinishing(true);
    try {
      if (data.aiKey.trim()) {
        try {
          await saveAiKey(data.aiProvider, data.aiKey.trim());
        } catch {
          // Non-fatal — the key can be re-entered from Settings.
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
        plan_refresh_cadence: data.planCadence,
        ai_provider: data.aiProvider,
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

      // Flipping onboarded_at makes the root layout route to Home.
      await completeOnboarding.mutateAsync();
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError ? err.message : "Couldn't save your preferences. Check your connection and try again."
      );
    } finally {
      setFinishing(false);
    }
  }

  const shared = { data, update, finishing, onFinish: handleFinish, username, errorMessage };
  return isDesktopWeb ? <DesktopOnboarding {...shared} /> : <MobileOnboarding {...shared} />;
}

interface LayoutProps {
  data: OnboardingData;
  update: StepProps['update'];
  finishing: boolean;
  onFinish: () => void;
  username?: string;
  errorMessage: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Phone (native + mobile web): one question per screen, photo hero on top,
// swipe or tap to move between steps.
// ─────────────────────────────────────────────────────────────────────────

function MobileOnboarding({ data, update, finishing, onFinish, username, errorMessage }: LayoutProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const translateX = useSharedValue(0);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;

  const step = STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;
  const skippable = step.isSkippable?.(data) ?? false;
  const heroHeight = Math.min(Math.max(windowHeight * 0.36, 210), 340) + insets.top;

  const primaryLabel = isLastStep ? (skippable ? 'Skip and finish' : 'Finish setup') : skippable ? 'Skip for now' : 'Continue';

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
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      // Rubber-band at the ends instead of hard-blocking, so the gesture still feels alive.
      const atEdge = (event.translationX > 0 && isFirstStep) || (event.translationX < 0 && isLastStep);
      translateX.value = atEdge ? event.translationX * 0.25 : event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX < -SWIPE_THRESHOLD && !isLastStep) {
        translateX.value = withTiming(-screenWidth, { duration: 180 }, () => {
          translateX.value = 0;
          runOnJS(setStepIndex)(Math.min(stepIndex + 1, STEPS.length - 1));
        });
      } else if (event.translationX > SWIPE_THRESHOLD && !isFirstStep) {
        translateX.value = withTiming(screenWidth, { duration: 180 }, () => {
          translateX.value = 0;
          runOnJS(setStepIndex)(Math.max(stepIndex - 1, 0));
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <View style={styles.mobileRoot}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.flex, animatedStyle]}>
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.mobileScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Animated.View key={step.key} entering={FadeIn.duration(250)}>
                <PhotoBackdrop source={ONBOARDING_IMAGES[step.image]} style={{ height: heroHeight }} />
              </Animated.View>

              <View style={styles.mobileContent}>
                {isFirstStep && username ? <Text style={styles.greeting}>Welcome, {username} 👋</Text> : null}
                <Text style={styles.title}>{step.title}</Text>
                {step.subtitle ? <Text style={styles.subtitle}>{step.subtitle}</Text> : null}
                <View style={styles.stepBody}>{step.render({ data, update })}</View>
              </View>
            </ScrollView>
          </Animated.View>
        </GestureDetector>

        {/* Floating top bar over the photo: back + progress */}
        <View style={[styles.topBar, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
          {isFirstStep ? (
            <View style={styles.backButtonPlaceholder} />
          ) : (
            <Pressable
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="Previous step"
              hitSlop={10}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          )}
          <View style={styles.progressWrap}>
            <OnboardingProgressBar step={stepIndex} totalSteps={STEPS.length} />
          </View>
          <Text style={styles.stepCount}>
            {stepIndex + 1}/{STEPS.length}
          </Text>
        </View>

        <SafeAreaView edges={['bottom']} style={styles.mobileFooter}>
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          <Button
            label={primaryLabel}
            variant={skippable ? 'secondary' : 'primary'}
            onPress={goNext}
            loading={finishing}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Desktop web: photo brand panel + one scrollable form with every section,
// and a pinned footer so "Finish setup" is always reachable.
// ─────────────────────────────────────────────────────────────────────────

function DesktopOnboarding({ data, update, finishing, onFinish, username, errorMessage }: LayoutProps) {
  return (
    <View style={styles.splitRoot}>
      <PhotoBackdrop source={HERO_IMAGE} fade="full" style={styles.splitPanel}>
        <View style={styles.splitInner}>
          <Logo size={30} textSize={22} />
          <View style={styles.splitCopy}>
            <Text style={styles.splitHeadline}>
              {username ? `Welcome, ${username}.\nLet's tailor Forge to you.` : "Let's tailor Forge to you."}
            </Text>
            <Text style={styles.splitBody}>
              A few quick preferences so every plan fits how you actually train. Takes about a minute, and everything
              can be changed later in Settings.
            </Text>
          </View>
        </View>
      </PhotoBackdrop>

      <View style={styles.formPanel}>
        <ScrollView contentContainerStyle={styles.formPanelContent} showsVerticalScrollIndicator={false}>
          <View style={styles.desktopForm}>
            {STEPS.map((step, index) => (
              <View key={step.key} style={styles.desktopSection}>
                <View style={styles.desktopSectionHead}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{index + 1}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.desktopSectionTitle}>{step.title}</Text>
                    {step.subtitle ? <Text style={styles.subtitle}>{step.subtitle}</Text> : null}
                  </View>
                </View>
                <View style={styles.desktopSectionBody}>{step.render({ data, update, wide: true })}</View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.desktopFooter}>
          <View style={styles.desktopFooterInner}>
            {errorMessage ? <Text style={[styles.error, styles.flex]}>{errorMessage}</Text> : <View style={styles.flex} />}
            <View style={styles.desktopFinish}>
              <Button label="Finish setup" onPress={onFinish} loading={finishing} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  // ── Phone ──
  mobileRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mobileScroll: {
    paddingBottom: spacing.lg,
  },
  mobileContent: {
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.lg,
    gap: spacing.sm,
  },
  topBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(11,14,17,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  progressWrap: {
    flex: 1,
  },
  stepCount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  greeting: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  stepBody: {
    marginTop: spacing.md,
  },
  mobileFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },

  // ── Shared step content ──
  optionList: {
    gap: spacing.sm,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionCellWide: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  fieldStack: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldRowNarrow: {
    flexWrap: 'wrap',
  },
  fieldRowItem: {
    flexGrow: 1,
    flexBasis: 96,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
  },

  // ── Desktop ──
  splitRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  splitPanel: {
    flex: 1,
    maxWidth: 560,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  splitInner: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  splitCopy: {
    gap: spacing.md,
  },
  splitHeadline: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 42,
  },
  splitBody: {
    color: colors.text,
    opacity: 0.85,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 400,
  },
  formPanel: {
    flex: 1.4,
  },
  formPanelContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  desktopForm: {
    width: '100%',
    maxWidth: 680,
    gap: spacing.xl + spacing.sm,
  },
  desktopSection: {
    gap: spacing.md,
  },
  desktopSectionHead: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  desktopSectionBody: {
    paddingLeft: 44,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBadgeText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  desktopSectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  desktopFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  desktopFooterInner: {
    width: '100%',
    maxWidth: 680,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  desktopFinish: {
    width: 200,
  },
});

