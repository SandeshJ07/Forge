import { apiClient } from '@/lib/apiClient';

/**
 * Lets the user supply their own Anthropic API key so plan generation is
 * billed to their account instead of the app's shared key. Stored
 * server-side only (see backend/app/api/anthropic_key.py) — never persisted
 * or logged on the client.
 */
export async function saveAnthropicApiKey(apiKey: string): Promise<void> {
  await apiClient.put('/anthropic-key', { api_key: apiKey });
}

export async function clearAnthropicApiKey(): Promise<void> {
  await apiClient.delete('/anthropic-key');
}
