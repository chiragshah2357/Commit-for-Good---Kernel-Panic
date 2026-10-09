import { create } from "zustand";
import type { Policy, Req } from "../../lib/types";
import type { Tool } from "../../components/map/MapCanvas";

export type Tab = "overview" | "methods" | "delivery" | "priorities" | "risk";
export type FloodMode = "preset" | "draw" | "river";
export const DEFAULT_WEIGHTS = { access: 0.35, supply: 0.35, equity: 0.15, reach: 0.15 };

export interface CalcState {
  // flood
  floodMode: FloodMode;
  preset: string;
  cutDraft: number[];
  outDraft: number[];
  height: number;
  distance: number;
  seed: number;
  // delivery set-up
  trucks: number;
  hubConfig: "single" | "three" | "custom";
  hubPoints: [number, number][];
  policy: Policy;
  stockMult: number;
  horizon: number;
  rateMult: number;
  speed: number;
  delayMin: number;
  weights: Record<string, number>;
  missingShare: number;
  // view
  tab: Tab;
  tool: Tool;
  showRoutes: boolean;
  showRivers: boolean;
  showRepair: boolean;
  set: (p: Partial<CalcState>) => void;
  reset: () => void;
}

const INITIAL = {
  floodMode: "preset" as FloodMode, preset: "severe_11", cutDraft: [] as number[], outDraft: [] as number[], height: 2.5, distance: 600, seed: 42,
  trucks: 4, hubConfig: "three" as const, hubPoints: [] as [number, number][], policy: "access_opt" as Policy, stockMult: 1, horizon: 14, rateMult: 1, speed: 1, delayMin: 30,
  weights: { ...DEFAULT_WEIGHTS }, missingShare: 0.2, tab: "overview" as Tab, tool: "pan" as Tool, showRoutes: true, showRivers: true, showRepair: true,
};

export const useCalc = create<CalcState>((set) => ({ ...INITIAL, set: (p) => set(p), reset: () => set({ ...INITIAL, weights: { ...DEFAULT_WEIGHTS } }) }));

/** The request body for the API, derived from the controls. */
export function toReq(s: CalcState): Req {
  const flood = s.floodMode === "preset" ? { mode: "preset" as const, preset: s.preset }
    : s.floodMode === "draw" ? { mode: "manual" as const, cut_segments: s.cutDraft, out_facilities: s.outDraft }
    : { mode: "parametric" as const, height_m: s.height, distance_m: s.distance, seed: s.seed };
  return {
    flood,
    setup: { trucks: s.trucks, hubs: { config: s.hubConfig, points: s.hubPoints }, stock_mult: s.stockMult, horizon: s.horizon, rate_mult: s.rateMult, policy: s.policy, speed: s.speed, delay_min: s.delayMin },
    weights: s.weights,
  };
}
