import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface RestAlertState {
  /** Notify when rest ends (this device only; the OS/browser permission is needed too). */
  enabled: boolean;
  /** The user closed the "turn on rest alerts" suggestion on the workout screen. */
  promptDismissed: boolean;
  setEnabled: (enabled: boolean) => void;
  dismissPrompt: () => void;
}

export const useRestAlertStore = create<RestAlertState>()(
  persist(
    (set) => ({
      enabled: false,
      promptDismissed: false,
      setEnabled: (enabled) => set({ enabled }),
      dismissPrompt: () => set({ promptDismissed: true }),
    }),
    { name: 'forge-rest-alerts', storage: createJSONStorage(() => AsyncStorage) }
  )
);
