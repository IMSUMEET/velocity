import { create } from "zustand";
import type { Snapshot } from "@velocity/engine";

interface State {
  snapshot: Snapshot | null;
  connected: boolean;
  setSnapshot: (s: Snapshot) => void;
  setConnected: (c: boolean) => void;
}

export const useStore = create<State>((set) => ({
  snapshot: null,
  connected: false,
  setSnapshot: (snapshot) => set({ snapshot }),
  setConnected: (connected) => set({ connected }),
}));
