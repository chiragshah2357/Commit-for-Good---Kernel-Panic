import { create } from "zustand";

interface PresenterState {
  active: boolean;
  step: number;
  notes: boolean;
  startedAt: number;
  toggle: () => void;
  start: () => void;
  stop: () => void;
  goto: (i: number) => void;
  toggleNotes: () => void;
}

export const usePresenter = create<PresenterState>((set, get) => ({
  active: false, step: 0, notes: false, startedAt: 0,
  toggle: () => (get().active ? get().stop() : get().start()),
  start: () => set({ active: true, step: 0, startedAt: Date.now() }),
  stop: () => set({ active: false, notes: false }),
  goto: (i) => set({ step: i }),
  toggleNotes: () => set((s) => ({ notes: !s.notes })),
}));
