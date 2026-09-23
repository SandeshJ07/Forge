import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { signOutAndReset } from '@/api/auth';
import { clearAnthropicApiKey, saveAnthropicApiKey } from '@/api/anthropicKey';
import { useQueryClient } from '@tanstack/react-query';
import { useUserProfile, useUpsertUserProfile } from '@/hooks/useUserProfile';
import type { ExperienceLevel, Gender, Goal, PlanRefreshCadence, UnitSystem } from '@/types/database';
import { colors, spacing } from '@/constants/theme';

const GOALS: Goal[] = ['strength', 'hypertrophy', 'general_fitness', 'endurance'];
const EXPERIENCE_LEVELS: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
const PLAN_CADENCES: PlanRefreshCadence[] = ['weekly', 'biweekly', 'monthly'];
const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { data: profile, refetch: refetchProfile } = useUserProfile();
  const upsertProfile = useUpsertUserProfile();

  const [anthropicKeyInput, setAnthropicKeyInput] = useState('');
  const [anthropicSaving, setAnthropicSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [birthYearInput, setBirthYearInput] = useState(profile?.birth_year?.toString() ?? '');
  const [heightInput, setHeightInput] = useState(
    profile?.height_cm != null
      ? profile.unit_system === 'imperial'
        ? (profile.height_cm / 2.54).toFixed(0)
        : profile.height_cm.toString()
      : ''
  );

  function handleSaveAboutYou() {
    const parsedBirthYear = parseInt(birthYearInput, 10);
    const parsedHeight = parseFloat(heightInput);
    const heightCm = Number.isFinite(parsedHeight)
      ? profile?.unit_system === 'imperial'
        ? parsedHeight * 2.54
        : parsedHeight
      : null;
    upsertProfile.mutate({
      birth_year: Number.isFinite(parsedBirthYear) ? parsedBirthYear : null,
      height_cm: heightCm,
    });
  }

  async function handleSaveAnthropicKey() {
    setErrorMessage(null);
    setAnthropicSaving(true);
    try {
      await saveAnthropicApiKey(anthropicKeyInput.trim());
      setAnthropicKeyInput('');
      await refetchProfile();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid Anthropic API key.');
    } finally {
      setAnthropicSaving(false);
    }
  }

  async function handleClearAnthropicKey() {
    await clearAnthropicApiKey();
    await refetchProfile();
  }

  async function handleSignOut() {
    await signOutAndReset(queryClient);
  }

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Settings</Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Card>
        <Text style={styles.cardTitle}>AI plan generation</Text>
        <Text style={styles.integrationStatus}>
          {profile?.anthropic_api_key_set
            ? 'Using your own Anthropic API key — plan generation is billed to your account.'
            : "Using the app's shared key. Add your own Anthropic API key to use your own account instead."}
        </Text>
        {profile?.anthropic_api_key_set ? (
          <Button label="Remove key" variant="secondary" onPress={handleClearAnthropicKey} />
        ) : (
          <View style={styles.keyForm}>
            <TextField
              placeholder="sk-ant-..."
              autoCapitalize="none"
              secureTextEntry
              value={anthropicKeyInput}
              onChangeText={setAnthropicKeyInput}
            />
            <Button label="Save" onPress={handleSaveAnthropicKey} loading={anthropicSaving} />
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>About you</Text>
        <Text style={styles.integrationStatus}>
          Optional — helps the AI set more appropriate starting weights and volume.
        </Text>

        <Text style={styles.fieldLabel}>Gender</Text>
        <View style={styles.chipsRow}>
          {GENDERS.map((g) => (
            <Text
              key={g.value}
              onPress={() => upsertProfile.mutate({ gender: g.value })}
              style={[styles.chip, profile?.gender === g.value && styles.chipActive]}
            >
              {g.label}
            </Text>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Birth year</Text>
        <TextField
          placeholder="e.g. 1995"
          keyboardType="number-pad"
          value={birthYearInput}
          onChangeText={setBirthYearInput}
          onBlur={handleSaveAboutYou}
        />

        <Text style={styles.fieldLabel}>Height ({profile?.unit_system === 'imperial' ? 'inches' : 'cm'})</Text>
        <TextField
          placeholder={profile?.unit_system === 'imperial' ? 'e.g. 68' : 'e.g. 173'}
          keyboardType="decimal-pad"
          value={heightInput}
          onChangeText={setHeightInput}
          onBlur={handleSaveAboutYou}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Goal</Text>
        <View style={styles.chipsRow}>
          {GOALS.map((goal) => (
            <Text
              key={goal}
              onPress={() => upsertProfile.mutate({ goal })}
              style={[styles.chip, profile?.goal === goal && styles.chipActive]}
            >
              {goal.replace(/_/g, ' ')}
            </Text>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Experience level</Text>
        <View style={styles.chipsRow}>
          {EXPERIENCE_LEVELS.map((level) => (
            <Text
              key={level}
              onPress={() => upsertProfile.mutate({ experience_level: level })}
              style={[styles.chip, profile?.experience_level === level && styles.chipActive]}
            >
              {level}
            </Text>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Warm-ups in generated plans</Text>
        <View style={styles.chipsRow}>
          <Text
            onPress={() => upsertProfile.mutate({ include_warmup: true })}
            style={[styles.chip, profile?.include_warmup !== false && styles.chipActive]}
          >
            Include warm-up
          </Text>
          <Text
            onPress={() => upsertProfile.mutate({ include_warmup: false })}
            style={[styles.chip, profile?.include_warmup === false && styles.chipActive]}
          >
            Skip warm-up
          </Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Plan refresh reminder</Text>
        <Text style={styles.integrationStatus}>
          How often you'd like to be reminded to regenerate your plan based on your progress.
        </Text>
        <View style={styles.chipsRow}>
          {PLAN_CADENCES.map((cadence) => (
            <Text
              key={cadence}
              onPress={() => upsertProfile.mutate({ plan_refresh_cadence: cadence })}
              style={[styles.chip, profile?.plan_refresh_cadence === cadence && styles.chipActive]}
            >
              {cadence}
            </Text>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Units</Text>
        <View style={styles.chipsRow}>
          {(['metric', 'imperial'] as UnitSystem[]).map((unit) => (
            <Text
              key={unit}
              onPress={() => upsertProfile.mutate({ unit_system: unit })}
              style={[styles.chip, profile?.unit_system === unit && styles.chipActive]}
            >
              {unit}
            </Text>
          ))}
        </View>
      </Card>

      <View style={styles.accountActions}>
        <Button label="Switch account" variant="secondary" onPress={handleSignOut} />
        <Button label="Sign out" variant="danger" onPress={handleSignOut} />
      </View>
      <Text style={styles.accountHint}>
        Only one account can be signed in on this device at a time. Signing out clears this account's
        cached data locally before returning to sign-in.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  integrationStatus: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  keyForm: {
    gap: spacing.sm,
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
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    textTransform: 'capitalize',
    overflow: 'hidden',
  },
  chipActive: {
    color: '#fff',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  accountActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  accountHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
