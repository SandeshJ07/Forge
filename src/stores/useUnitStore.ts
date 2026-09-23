import { create } from 'zustand';
import type { UnitSystem } from '@/types/database';

interface UnitState {
  unitSystem: UnitSystem;
  setUnitSystem: (unit: UnitSystem) => void;
}

// Seeded from the user_profiles row on load (see src/hooks/useUserProfile.ts);
// kept in Zustand so unit formatting is synchronous everywhere without prop drilling.
export const useUnitStore = create<UnitState>((set) => ({
  unitSystem: 'metric',
  setUnitSystem: (unitSystem) => set({ unitSystem }),
}));
