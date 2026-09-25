import { apiClient } from '@/lib/apiClient';
import type { AIProvider } from '@/types/database';

/**
 * Lets the user supply their own key for the AI provider they picked, so plan
 * generation is billed to their account instead of the app's shared key.
 * Stored server-side only (backend/app/api/ai_keys.py) — never persisted or
 * logged on the client.
 */
export async function saveAiKey(provider: AIProvider, apiKey: string): Promise<void> {
  await apiClient.put(`/ai-keys/${provider}`, { api_key: apiKey });
}

export async function clearAiKey(provider: AIProvider): Promise<void> {
  await apiClient.delete(`/ai-keys/${provider}`);
}
