import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { signOutAndReset, updateUsername } from '@/api/auth';
import { clearAiKey, saveAiKey } from '@/api/aiKeys';
import { AI_PROVIDERS, providerInfo } from '@/constants/aiProviders';
import type { AIProvider } from '@/types/database';
import { ApiError } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUserProfile, useUpsertUserProfile } from '@/hooks/useUserProfile';
import { EQUIPMENT_OPTIONS } from '@/constants/equipment';
import { InstallAppSheet } from '@/components/InstallAppSheet';
import { useIsMobileWeb } from '@/hooks/useResponsive';
import { usePwaInstall } from '@/lib/pwaInstall';
import type { ExperienceLevel, Gender, Goal, PlanRefreshCadence, UnitSystem } from '@/types/database';
import { colors, spacing } from '@/constants/theme';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Build muscle' },
  { value: 'general_fitness', label: 'General fitness' },
  { value: 'endurance', label: 'Endurance' },
];
const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
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
const UNITS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Metric (kg, cm)' },
  { value: 'imperial', label: 'Imperial (lb, in)' },
];

type Message = { text: string; isError: boolean } | null;

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { data: profile, refetch: refetchProfile } = useUserProfile();
  const upsertProfile = useUpsertUserProfile();
  const username = useAuthStore((s) => s.session?.username ?? '');
  const isMobileWeb = useIsMobileWeb();
  const pwa = usePwaInstall();
  const [installSheetOpen, setInstallSheetOpen] = useState(false);

  async function handleInstallApp() {
    const outcome = pwa.method === 'prompt' ? await pwa.promptInstall() : 'unavailable';
    if (outcome === 'unavailable') setInstallSheetOpen(true);
  }

  const [usernameInput, setUsernameInput] = useState(username);
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<Message>(null);

  const [aiKeyInput, setAiKeyInput] = useState('');
  const [aiKeySaving, setAiKeySaving] = useState(false);
  const [aiMessage, setAiMessage] = useState<Message>(null);

  const [birthYearInput, setBirthYearInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const isImperial = profile?.unit_system === 'imperial';

  // Inputs are seeded from data that loads asynchronously (session + profile),
  // so keep them in sync once it arrives instead of freezing the first empty render.
  useEffect(() => {
    setUsernameInput(username);
  }, [username]);

  useEffect(() => {
    if (!profile) return;
    setBirthYearInput(profile.birth_year?.toString() ?? '');
    setHeightInput(
      profile.height_cm != null
        ? isImperial
          ? (Number(profile.height_cm) / 2.54).toFixed(0)
          : String(Math.round(Number(profile.height_cm)))
        : ''
    );
  }, [profile, isImperial]);

  function handleSaveAboutYou() {
    const parsedBirthYear = parseInt(birthYearInput, 10);
    const parsedHeight = parseFloat(heightInput);
    upsertProfile.mutate({
      birth_year: Number.isFinite(parsedBirthYear) ? parsedBirthYear : null,
      height_cm: Number.isFinite(parsedHeight) ? (isImperial ? parsedHeight * 2.54 : parsedHeight) : null,
    });
  }

  async function handleSaveUsername() {
    setUsernameMessage(null);
    setUsernameSaving(true);
    try {
      await updateUsername(usernameInput.trim());
      setUsernameMessage({ text: 'Username updated.', isError: false });
    } catch (err) {
      setUsernameMessage({ text: err instanceof ApiError ? err.message : 'Could not update username.', isError: true });
    } finally {
      setUsernameSaving(false);
    }
  }

  const provider = providerInfo(profile?.ai_provider);
  const hasOwnKey = provider.value === 'gemini' ? profile?.gemini_api_key_set : profile?.anthropic_api_key_set;

  async function handleSaveAiKey() {
    setAiMessage(null);
    setAiKeySaving(true);
    try {
      await saveAiKey(provider.value, aiKeyInput.trim());
      setAiKeyInput('');
      await refetchProfile();
      setAiMessage({ text: `${provider.name} key saved — new plans will use your account.`, isError: false });
    } catch (err) {
      setAiMessage({
        text: err instanceof ApiError ? err.message : "That key didn't work. Check it and try again.",
        isError: true,
      });
    } finally {
      setAiKeySaving(false);
    }
  }

  async function handleClearAiKey() {
    setAiMessage(null);
    await clearAiKey(provider.value);
    await refetchProfile();
  }

  function handleChooseProvider(value: AIProvider) {
    setAiMessage(null);
    setAiKeyInput('');
    upsertProfile.mutate({ ai_provider: value });
  }

  // Held locally so quick successive taps build on each other instead of each
  // one starting from the last server response (which would drop taps).
  const [equipment, setEquipment] = useState<string[]>([]);
  useEffect(() => {
    if (profile) setEquipment(profile.equipment_access ?? []);
  }, [profile]);

  function toggleEquipment(value: string) {
    const next = equipment.includes(value) ? equipment.filter((e) => e !== value) : [...equipment, value];
    setEquipment(next);
    upsertProfile.mutate({ equipment_access: next });
  }

  const usernameChanged = usernameInput.trim() !== '' && usernameInput.trim() !== username;

  return (
    <ScreenContainer>
      <ScreenHeader title="Settings" subtitle="Changes save automatically unless there's a Save button." />

      <Section title="Account">
        <Card style={styles.card}>
          <TextField
            label="Username"
            autoCapitalize="none"
            autoCorrect={false}
            value={usernameInput}
            onChangeText={(v) => {
              setUsernameInput(v);
              setUsernameMessage(null);
            }}
          />
          {usernameMessage ? <InlineMessage message={usernameMessage} /> : null}
          {usernameChanged ? (
            <Button label="Save username" onPress={handleSaveUsername} loading={usernameSaving} />
          ) : null}
        </Card>
      </Section>

      <Section title="Training" hint="Used every time a plan is generated.">
        <Card style={styles.card}>
          <Field label="Goal">
            <ChipGroup>
              {GOALS.map((g) => (
                <Chip
                  key={g.value}
                  label={g.label}
                  selected={profile?.goal === g.value}
                  onPress={() => upsertProfile.mutate({ goal: g.value })}
                />
              ))}
            </ChipGroup>
          </Field>
          <Field label="Experience">
            <ChipGroup>
              {EXPERIENCE_LEVELS.map((l) => (
                <Chip
                  key={l.value}
                  label={l.label}
                  selected={profile?.experience_level === l.value}
                  onPress={() => upsertProfile.mutate({ experience_level: l.value })}
                />
              ))}
            </ChipGroup>
          </Field>
          <Field label="Equipment you have">
            <ChipGroup>
              {EQUIPMENT_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  showCheck
                  selected={equipment.includes(option.value)}
                  onPress={() => toggleEquipment(option.value)}
                />
              ))}
            </ChipGroup>
            {!equipment.length ? (
              <Text style={styles.hint}>Nothing selected — plans will assume a standard commercial gym.</Text>
            ) : null}
          </Field>
          <Field label="Plan refresh reminder">
            <ChipGroup>
              {PLAN_CADENCES.map((c) => (
                <Chip
                  key={c.value}
                  label={c.label}
                  selected={profile?.plan_refresh_cadence === c.value}
                  onPress={() => upsertProfile.mutate({ plan_refresh_cadence: c.value })}
                />
              ))}
            </ChipGroup>
          </Field>
        </Card>
      </Section>

      <Section title="About you" hint="Optional — helps set sensible starting weights and volume.">
        <Card style={styles.card}>
          <Field label="Gender">
            <ChipGroup>
              {GENDERS.map((g) => (
                <Chip
                  key={g.value}
                  label={g.label}
                  selected={profile?.gender === g.value}
                  onPress={() => upsertProfile.mutate({ gender: g.value })}
                />
              ))}
            </ChipGroup>
          </Field>
          <View style={styles.inputRow}>
            <View style={styles.inputRowItem}>
              <TextField
                label="Birth year"
                placeholder="1995"
                keyboardType="number-pad"
                maxLength={4}
                value={birthYearInput}
                onChangeText={(v) => setBirthYearInput(v.replace(/\D/g, ''))}
                onBlur={handleSaveAboutYou}
              />
            </View>
            <View style={styles.inputRowItem}>
              <TextField
                label={`Height (${isImperial ? 'in' : 'cm'})`}
                placeholder={isImperial ? '68' : '173'}
                keyboardType="decimal-pad"
                value={heightInput}
                onChangeText={setHeightInput}
                onBlur={handleSaveAboutYou}
              />
            </View>
          </View>
        </Card>
      </Section>

      <Section title="Units">
        <Card style={styles.card}>
          <ChipGroup>
            {UNITS.map((u) => (
              <Chip
                key={u.value}
                label={u.label}
                selected={profile?.unit_system === u.value}
                onPress={() => upsertProfile.mutate({ unit_system: u.value })}
              />
            ))}
          </ChipGroup>
        </Card>
      </Section>

      <Section title="AI plan generation" hint="Choose which AI builds your training plans.">
        <Card style={styles.card}>
          <Field label="Provider">
            <ChipGroup>
              {AI_PROVIDERS.map((p) => (
                <Chip
                  key={p.value}
                  label={`${p.name} (${p.company})`}
                  selected={provider.value === p.value}
                  onPress={() => handleChooseProvider(p.value)}
                />
              ))}
            </ChipGroup>
          </Field>
          <Text style={styles.bodyText}>
            {hasOwnKey
              ? `Using your own ${provider.name} API key — plan generation is billed to your ${provider.company} account.`
              : `Using the app's shared ${provider.name} key, if one is set up. Add your own to bill plan generation to your ${provider.company} account instead.`}
          </Text>
          {aiMessage ? <InlineMessage message={aiMessage} /> : null}
          {hasOwnKey ? (
            <Button label={`Remove my ${provider.name} key`} variant="secondary" onPress={handleClearAiKey} />
          ) : (
            <>
              <TextField
                label={`${provider.name} API key`}
                placeholder={provider.keyPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                value={aiKeyInput}
                onChangeText={setAiKeyInput}
                onSubmitEditing={handleSaveAiKey}
              />
              <Text style={styles.hint}>{provider.keyHelp}</Text>
              {aiKeyInput.trim() ? (
                <Button label={`Save ${provider.name} key`} onPress={handleSaveAiKey} loading={aiKeySaving} />
              ) : null}
            </>
          )}
        </Card>
      </Section>

      {isMobileWeb ? (
        <Section title="App">
          <Card style={styles.card}>
            {pwa.installed ? (
              <Text style={styles.bodyText}>You're using the installed Forge app.</Text>
            ) : (
              <>
                <Text style={styles.bodyText}>
                  Install Forge on your home screen — it opens full-screen like a regular app, with no browser bars.
                </Text>
                <Button label="Install app" onPress={handleInstallApp} />
              </>
            )}
          </Card>
          <InstallAppSheet
            visible={installSheetOpen}
            method={pwa.fallbackMethod}
            onClose={() => setInstallSheetOpen(false)}
          />
        </Section>
      ) : null}

      <View style={styles.signOut}>
        <Button label="Sign out" variant="secondary" onPress={() => signOutAndReset(queryClient)} />
        <Text style={styles.hint}>
          To switch accounts, sign out and sign in with the other one. Signing out clears this account's data from
          this device.
        </Text>
      </View>
    </ScreenContainer>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function InlineMessage({ message }: { message: NonNullable<Message> }) {
  return <Text style={message.isError ? styles.error : styles.success}>{message.text}</Text>;
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionHead: {
    gap: 2,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputRowItem: {
    flex: 1,
  },
  bodyText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  success: {
    color: colors.success,
    fontSize: 14,
  },
  signOut: {
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});
