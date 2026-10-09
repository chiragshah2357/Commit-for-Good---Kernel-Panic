// Shapes of the static data files (web/public/data) and the API responses (floodready/api.py).

export interface RoadSeg { id: number; c: string; n: string; k: number; p: number[][] }
export interface HubPoint { node: number; lon: number; lat: number }
export interface Geometry {
  bounds: [number, number, number, number];
  roads: RoadSeg[];
  rivers: { k: string; n: string; p: number[] }[];
  hull: number[];
  villages: { id: number[]; name: string[]; pop: number[]; lon: number[]; lat: number[] };
  facilities: { id: number[]; name: string[]; lon: number[]; lat: number[]; stock: number[]; demand: number[] };
  depot: { lon: number; lat: number; node: number };
  hubs: { single: HubPoint[]; three: HubPoint[] };
}

export interface Preset {
  name: string; severity: "mild" | "moderate" | "severe"; height_m: number; distance_m: number;
  segments_cut: number; share_road_cut: number; facilities_out: number; cut: number[]; out: number[];
}
export interface ScenariosFile {
  presets: Preset[];
  hero: { scenario: string; access: Access; status: number[]; scenario_block: Record<string, number | string>; policies: Record<string, { unmet_units: number; total_unmet_units: number; visits: number; index: number }> };
}

export type Policy = "none" | "proportional" | "nearest_first" | "nearest_first_post" | "access_opt";
export const POLICIES: Policy[] = ["none", "proportional", "nearest_first", "nearest_first_post", "access_opt"];
export const POLICY_LABEL: Record<Policy, string> = {
  none: "Do nothing", proportional: "Proportional", nearest_first: "Nearest-first (blind)",
  nearest_first_post: "Nearest-first (informed)", access_opt: "Access-aware optimiser",
};
export const POLICY_SHORT: Record<Policy, string> = {
  none: "Do nothing", proportional: "Proportional", nearest_first: "Blind nearest", nearest_first_post: "Informed nearest", access_opt: "Optimiser",
};
export const POLICY_COLOR: Record<Policy, string> = {
  none: "#9c9486", proportional: "#c98a1b", nearest_first: "#7a8ca3", nearest_first_post: "#5e8c6a", access_opt: "#1d4e89",
};

export interface Access {
  population: number; pop_cut_off: number; pop_delayed_only: number; pop_unconnected: number; villages_cut_off: number; villages_delayed: number;
  share_cut_off: number; share_delayed_only: number;
  mean_before: number | null; mean_after: number | null; median_before: number | null; median_after: number | null; p90_before: number | null; p90_after: number | null;
}
export interface IndexResult {
  value: number; components: Record<"access" | "supply" | "equity" | "reach", number>; weights: Record<string, number>; contributions: Record<string, number>;
}
export interface PlanSummary {
  policy: Policy; label: string; unmet_units: number; cut_off_units: number; total_unmet_units: number; none_unmet_units: number; avoidable_units: number;
  capture_rate: number | null; delivered: number; useful_delivered: number; waste_share: number; truck_hours: number; truck_hour_budget: number; visits: number;
  hubs: number; facilities_stocked_out: number; facilities_unreachable: number; unmet_gini: number; index: IndexResult;
}
export interface FacilityRow {
  id: number; name: string; working: boolean; depot_min: number | null; stock: number; demand: number; shortfall: number; deliver: number; unmet: number; hub: number;
}
export interface RouteOut { facility_id: number; hub: number; units: number; path: [number, number][] }
export interface Trip { facility_id: number; name: string; units: number; hours: number; hub: number; truck: number; start: number; end: number }
export interface Schedule { trips: Trip[]; day_hours: number; days: number; capacity_hours: number; loads: number[]; overflow_trips: number; truck_capacity_units: number }
export interface RankedVillage { hab_id: number; name: string; population: number; status: number; time_before: number | null; time_after: number | null }

export interface SimResult {
  scenario: { name: string; severity: string; cut_segments: number[]; out_facilities: number[]; road_km_cut: number; share_road_cut: number; segments_cut: number; facilities_out: number };
  hubs: HubPoint[];
  setup: Record<string, unknown>;
  access: Access;
  villages: { status: number[]; time_before: (number | null)[]; time_after: (number | null)[]; facility_after: number[] };
  policies: Record<Policy, PlanSummary>;
  chosen: { policy: Policy; facilities: FacilityRow[]; routes: RouteOut[]; schedule: Schedule };
  no_flood_index: IndexResult;
  decomposition: { cut_off_villages: number; unreachable_facilities: number; reachable_not_served: number; useful_delivered: number; wasted: number; removed_by_information: number; removed_by_optimisation: number };
  ranking: RankedVillage[];
  weights: Record<string, number>;
  ms: number;
}
export interface PairedRow { reference: Policy; label: string; mean_diff: number; ci_low: number; ci_high: number; win_rate: number; tie_rate: number; wilcoxon_p: number | null; n: number }
export interface EnsembleResult {
  n: number; policy: Policy;
  policies: Record<Policy, { label: string; total_unmet_mean: number; total_unmet_lo: number; total_unmet_hi: number; unmet_mean: number; unmet_lo: number; unmet_hi: number;
    index_mean: number; index_lo: number; index_hi: number; cvar10_total_unmet: number; worst_total_unmet: number; mean_capture: number | null }>;
  by_severity: Record<Policy, Record<string, number>>;
  paired: PairedRow[];
  scenarios: { name: string; severity: string; total_unmet: number; unmet: number; index: number; share_cut_off: number }[];
  ms: number;
}
export interface ParetoResult {
  policy: Policy; knee: number; rule: string; ms: number;
  rows: { trucks: number; unmet: number; total_unmet: number; truck_hours: number; budget_hours: number; visits: number; ens_mean: number; ens_p90: number }[];
}
export interface RepairResult {
  rows: { seg_id: number; road_name: string; category: string; length_km: number; residents_regained: number; person_minutes_saved: number }[];
  candidates: number; cut_segments: number; residents_cut_off: number; ms: number;
}
export interface Band { p05: number; p50: number; p95: number; values: number[] }
export interface UncertaintyResult { missing_share: number; reps: number; share_cut_off: Band; total_unmet: Band; index: Band; ms: number }
export interface PreviewResult { name: string; cut_segments: number[]; out_facilities: number[]; road_km_cut: number; share_road_cut: number; segments_cut: number; facilities_out: number; share_cut_off: number; pop_cut_off: number }
export interface Meta {
  presets: Omit<Preset, "cut" | "out">[];
  policies: { id: Policy; label: string }[];
  hubs: { single: HubPoint[]; three: HubPoint[] };
  defaults: Record<string, unknown>;
  assumptions: { rate_per_person_day: number; horizon_days: number; delivery_days: number; truck_capacity_units: number; truck_hours_per_day: number; service_hours: number; depot_days_of_cover: number; depot_stock_units: number };
  index: { weights: Record<string, number>; labels: Record<string, string>; formula: Record<string, string>; short_limit: number };
  counts: { villages: number; facilities: number; road_segments: number; residents: number };
}

// request bodies
export interface FloodReq { mode: "preset" | "manual" | "parametric"; preset?: string; cut_segments?: number[]; out_facilities?: number[]; height_m?: number; distance_m?: number; seed?: number; outage_prob?: number }
export interface SetupReq { trucks: number; hubs: { config: "single" | "three" | "custom"; points: [number, number][] }; stock_mult: number; horizon: number; rate_mult: number; policy: Policy; speed: number; delay_min: number }
export interface Req { flood: FloodReq; setup: SetupReq; weights?: Record<string, number> | null }

// evidence.json (the parts the figures use)
export interface Evidence {
  profile: any; validation: any;
  village_bands: { band: string; low: number; high: number; villages: number; residents: number }[];
  road_categories: { RoadCatego: string; segments: number; km: number; share_km: number }[];
  access_cdf: { minutes: number; residents_within_share: number }[];
  catchments: { facility_id: number; name: string; residents_served: number; stock_units: number; demand_per_day: number; days_of_cover: number | null }[];
  snap_mvp: { snap_m: number; nodes: number; components: number; segments_in_main_share: number; residents_attached_share: number }[];
  snap_round1: { snap_m: number; segments: number; residents: number; components: number }[];
  scenario_summary: { scenario: string; severity: string; flood_height_m: number; flood_distance_m: number; segments_cut: number; share_road_length_cut: number; facilities_out: number }[];
  access_by_severity: any[]; alloc_stats: any[]; alloc_means: any[]; paired: any[]; hub_resilience: any[]; sensitivity: any[]; sensitivity_speed: any[]; sensitivity_snap: any[];
  robustness: { missing_share: number; overlap: number; delta: number; share_cut_off: number }[];
  village_baseline: { id: number[]; time: (number | null)[] };
  vulnerability_top: { hab_id: number; name: string; population: number; cut_off_freq: number; cut_off_freq_mild: number; cut_off_freq_moderate: number; cut_off_freq_severe: number; expected_residents_cut_off: number }[];
  vulnerability_freq: { id: number[]; freq: number[] };
  criticality_top: { seg_id: number; road_name: string; category: string; owner: string; length_km: number; residents_cut_off: number; extra_person_minutes: number; extra_pm_share_of_total: number }[];
  critical_seg_ids: number[];
  hubs_json: Record<string, number[]>;
}
