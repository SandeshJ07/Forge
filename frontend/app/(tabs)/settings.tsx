import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { RefreshReminderPicker } from '@/components/RefreshReminderPicker';
import { changePassword, deleteAccount, requestSetPasswordCode, signOutAndReset, updateUsername } from '@/api/auth';
import { clearAiKey, saveAiKey } from '@/api/aiKeys';
import { AI_PROVIDERS, providerInfo } from '@/constants/aiProviders';
import type { AIProvider } from '@/types/database';
import { ApiError } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUserProfile, useUpsertUserProfile } from '@/hooks/useUserProfile';
import { usePlanUsage } from '@/hooks/usePlans';
import { formatCountdown, useResendCooldown } from '@/hooks/useResendCooldown';
import { EQUIPMENT_OPTIONS } from '@/constants/equipment';
import { GOAL_OPTIONS, MAX_GOALS, toggleGoal } from '@/constants/goals';
import { InstallAppSheet } from '@/components/InstallAppSheet';
import { useIsMobileWeb } from '@/hooks/useResponsive';
import { usePwaInstall } from '@/lib/pwaInstall';
import type { ExperienceLevel, Gender, UnitSystem } from '@/types/database';
import { colors, spacing } from '@/constants/theme';

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
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
  const { data: usage } = usePlanUsage();
  // Adding, removing or switching keys changes whether the daily limit applies.
  const refreshUsage = () => queryClient.invalidateQueries({ queryKey: ['plan-usage'] });

  async function handleSaveAiKey() {
    setAiMessage(null);
    setAiKeySaving(true);
    try {
      await saveAiKey(provider.value, aiKeyInput.trim());
      setAiKeyInput('');
      await refetchProfile();
      refreshUsage();
      setAiMessage({
        text: `${provider.name} key saved — plan generation now has no daily limit and is billed to your account.`,
        isError: false,
      });
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
    refreshUsage();
  }

  function handleChooseProvider(value: AIProvider) {
    setAiMessage(null);
    setAiKeyInput('');
    upsertProfile.mutate({ ai_provider: value }, { onSuccess: refreshUsage });
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
        {profile ? <PasswordCard hasPassword={profile.has_password} /> : null}
      </Section>

      <Section title="Training" hint="Used every time a plan is generated.">
        <Card style={styles.card}>
          <Field label={`Goals (up to ${MAX_GOALS})`}>
            <ChipGroup>
              {GOAL_OPTIONS.map((g) => {
                const goals = profile?.goals ?? [];
                const selected = goals.includes(g.value);
                return (
                  <Chip
                    key={g.value}
                    label={g.label}
                    showCheck
                    selected={selected}
                    disabled={goals.length >= MAX_GOALS && !selected}
                    onPress={() => upsertProfile.mutate({ goals: toggleGoal(goals, g.value) })}
                  />
                );
              })}
            </ChipGroup>
            <Text style={styles.hint}>
              {(profile?.goals?.length ?? 0) >= MAX_GOALS
                ? `Main goal: ${GOAL_OPTIONS.find((o) => o.value === profile?.goals[0])?.label}. Tap one to remove it and pick another.`
                : 'The first goal you pick is your main one.'}
            </Text>
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
            <RefreshReminderPicker
              cadence={profile?.plan_refresh_cadence ?? 'monthly'}
              days={profile?.plan_refresh_days ?? null}
              onChange={(cadence, days) =>
                upsertProfile.mutate({ plan_refresh_cadence: cadence, plan_refresh_days: days })
              }
            />
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

      <Section
        title="AI plan generation"
        hint={`Plans are built with the app's AI — ${usage?.limit ?? 5} free generations a day. Optional: add your own key for unlimited use.`}
      >
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
              : `Using the app's built-in AI${usage?.remaining != null ? ` — ${usage.remaining} of ${usage.limit} generations left today` : ''}. For unlimited generations, add your own ${provider.name} API key below; usage is then billed to your ${provider.company} account.`}
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

      <DeleteAccountSection hasPassword={profile?.has_password ?? true} username={profile ? username : undefined} />
    </ScreenContainer>
  );
}

const MIN_PASSWORD_LENGTH = 6;

/**
 * Change password (current one required) — or, for accounts made with Google
 * that have none yet, set one using a code emailed to the account's address.
 */
function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.userId);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const resend = useResendCooldown();

  function sendCode() {
    run(async () => {
      setCodeSentTo(await requestSetPasswordCode());
      resend.start();
    });
  }

  function reset() {
    setOpen(false);
    setCurrent('');
    setCode('');
    setCodeSentTo(null);
    setNext('');
    setConfirm('');
  }

  async function run(fn: () => Promise<void>) {
    setMessage(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setMessage({ text: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.', isError: true });
    } finally {
      setBusy(false);
    }
  }

  const mismatch = Boolean(confirm) && next !== confirm;
  const tooShort = Boolean(next) && next.length < MIN_PASSWORD_LENGTH;
  const proofReady = hasPassword ? Boolean(current) : code.trim().length === 6;
  const canSave = proofReady && next.length >= MIN_PASSWORD_LENGTH && next === confirm;

  function handleSave() {
    run(async () => {
      await changePassword(hasPassword ? { currentPassword: current } : { code: code.trim() }, next);
      const wasSet = !hasPassword;
      reset();
      setMessage({
        text: wasSet
          ? 'Password set. You can now sign in with your email or username and this password, or with Google.'
          : 'Password changed.',
        isError: false,
      });
      if (wasSet) queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
    });
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.fieldLabel}>Password</Text>
      {!open ? (
        <>
          <Text style={styles.bodyText}>
            {hasPassword
              ? 'Change the password you use to sign in with your email or username.'
              : "You sign in with Google, so there's no password yet. Set one to also sign in with your email or username."}
          </Text>
          {message ? <InlineMessage message={message} /> : null}
          <Button
            label={hasPassword ? 'Change password' : 'Set a password'}
            variant="secondary"
            onPress={() => {
              setMessage(null);
              setOpen(true);
            }}
          />
        </>
      ) : (
        <>
          {hasPassword ? (
            <TextField
              label="Current password"
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              value={current}
              onChangeText={setCurrent}
            />
          ) : codeSentTo ? (
            <>
              <Text style={styles.hint}>We sent a 6-digit code to {codeSentTo}.</Text>
              <TextField
                label="Code from the email"
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
              />
              {resend.remaining > 0 ? (
                <Text style={styles.cancelLink} accessibilityLiveRegion="polite">
                  Send a new code in {formatCountdown(resend.remaining)}
                </Text>
              ) : (
                <Text style={styles.resendLink} onPress={busy ? undefined : sendCode} accessibilityRole="button">
                  Send a new code
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.bodyText}>
                To make sure it's you, we'll email a 6-digit code to your account's address.
              </Text>
              {message ? <InlineMessage message={message} /> : null}
              <Button
                label={resend.remaining > 0 ? `Email me a code (${formatCountdown(resend.remaining)})` : 'Email me a code'}
                onPress={sendCode}
                loading={busy}
                disabled={resend.remaining > 0}
              />
            </>
          )}

          {hasPassword || codeSentTo ? (
            <>
              <TextField
                label="New password"
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                value={next}
                onChangeText={setNext}
              />
              <TextField
                label="Confirm new password"
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                value={confirm}
                onChangeText={setConfirm}
                onSubmitEditing={canSave ? handleSave : undefined}
              />
              {tooShort ? (
                <Text style={styles.error}>Use at least {MIN_PASSWORD_LENGTH} characters.</Text>
              ) : mismatch ? (
                <Text style={styles.error}>The new passwords don't match.</Text>
              ) : null}
              {message ? <InlineMessage message={message} /> : null}
              <Button
                label={hasPassword ? 'Change password' : 'Set password'}
                onPress={handleSave}
                loading={busy}
                disabled={!canSave}
              />
            </>
          ) : null}
          <Text
            style={styles.cancelLink}
            onPress={() => {
              reset();
              setMessage(null);
            }}
            accessibilityRole="button"
          >
            Cancel
          </Text>
        </>
      )}
    </Card>
  );
}

/** Permanent, so it asks twice: open the form, then re-confirm with the password (or username for Google-only accounts). */
function DeleteAccountSection({ hasPassword, username }: { hasPassword: boolean; username?: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setValue('');
    setError(null);
  }

  async function handleDelete() {
    setError(null);
    setBusy(true);
    try {
      await deleteAccount(hasPassword ? { password: value } : { confirmUsername: value.trim() }, queryClient);
      // Signed out: the root layout takes the user to the sign-in screen.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete your account. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Section title="Delete account">
      <Card style={[styles.card, styles.dangerCard]}>
        <Text style={styles.bodyText}>
          Permanently deletes your account and everything in it — workouts, plans, measurements, records and settings.
          This can't be undone.
        </Text>
        {open ? (
          <>
            <TextField
              label={hasPassword ? 'Enter your password to confirm' : `Type your username (${username ?? ''}) to confirm`}
              value={value}
              onChangeText={setValue}
              secureTextEntry={hasPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={hasPassword ? 'current-password' : 'off'}
              onSubmitEditing={value ? handleDelete : undefined}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label="Permanently delete my account"
              variant="danger"
              onPress={handleDelete}
              loading={busy}
              disabled={!value.trim()}
            />
            <Text style={styles.cancelLink} onPress={close} accessibilityRole="button">
              Cancel
            </Text>
          </>
        ) : (
          <Button label="Delete account" variant="danger" onPress={() => setOpen(true)} />
        )}
      </Card>
    </Section>
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
  resendLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spacing.xs,
    cursor: 'pointer',
  },
  dangerCard: {
    borderColor: 'rgba(255,92,92,0.35)',
  },
  cancelLink: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spacing.xs,
    cursor: 'pointer',
  },
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
