import { apiClient } from '@/lib/apiClient';
import type { PersonalRecord } from '@/types/database';

export interface PersonalRecordWithExercise extends PersonalRecord {
  exercise_name: string;
}

export async function fetchPersonalRecords(): Promise<PersonalRecordWithExercise[]> {
  return apiClient.get<PersonalRecordWithExercise[]>('/personal-records');
}
