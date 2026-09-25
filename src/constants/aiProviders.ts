import type { AIProvider } from '@/types/database';

export interface AIProviderInfo {
  value: AIProvider;
  name: string;
  company: string;
  keyPlaceholder: string;
  keyHelp: string;
}

/** The AI providers a user can choose for plan generation. Mirrors backend/app/services/ai_providers.py. */
export const AI_PROVIDERS: AIProviderInfo[] = [
  {
    value: 'anthropic',
    name: 'Claude',
    company: 'Anthropic',
    keyPlaceholder: 'sk-ant-…',
    keyHelp: 'Create a key at console.anthropic.com → API keys.',
  },
  {
    value: 'gemini',
    name: 'Gemini',
    company: 'Google',
    keyPlaceholder: 'AIza…',
    keyHelp: 'Create a key at aistudio.google.com → Get API key.',
  },
];

export function providerInfo(provider: AIProvider | undefined): AIProviderInfo {
  return AI_PROVIDERS.find((p) => p.value === provider) ?? AI_PROVIDERS[0];
}
