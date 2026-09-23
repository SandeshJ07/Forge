import { create } from 'zustand';

export interface Session {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  session: Session | null;
  isInitializing: boolean;
  setSession: (session: Session | null) => void;
  setInitializing: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isInitializing: true,
  setSession: (session) => set({ session }),
  setInitializing: (value) => set({ isInitializing: value }),
}));
