import type { CalcState } from "../pages/calculator/store";

/* The 5-minute talk track (docs/DEMO_SCRIPT.md) as steps. Each step opens a page, scrolls to an anchor or sets the calculator,
   and carries the words and verified numbers for the speaker notes (press N). */
export interface Step {
  at: number;           // planned time in seconds
  title: string;
  to: string;
  anchor?: string;
  calc?: Partial<CalcState>;
  say: string;
  numbers: string[];
}

export const STEPS: Step[] = [
  { at: 0, title: "Where this comes from: official open data", to: "/evidence", anchor: "ingestion",
    say: "We started from official open data, the PMGSY rural-roads dataset for Cachar. The facility layer needed cleaning before it meant anything.",
    numbers: ["119 'Medical' entries, 32 veterinary removed, 87 human-health facilities kept", "Roads, villages, facilities: real (July 2022 snapshot)", "Floods, stock, depot, fleet: generated and declared"] },
  { at: 30, title: "The district before any flood", to: "/evidence", anchor: "profile",
    say: "This is the district: how many people, how much road, and how far people are from care before any flood.",
    numbers: ["1,188 villages, 1.62 M residents, 3,525 km of road", "Median 10 min and 90th percentile 24 min to a facility", "63,853 residents already over 30 min from care"] },
  { at: 75, title: "Data quality: fragments joined into one network", to: "/evidence", anchor: "network",
    say: "The published roads are not connected: 211 fragments. We split lines at junctions and snap within 10 metres. We also found the load on facilities is uneven.",
    numbers: ["98.7% of segments joined into one network", "11 facilities serve nobody; one serves 108,804 residents", "Circuity 1.37 (road distance over straight line), plausible"] },
  { at: 120, title: "Exposure across 60 simulated floods", to: "/evidence", anchor: "exposure",
    say: "Before any single scenario: which villages and which roads are most exposed across all 60 simulated floods?",
    numbers: ["One road, Fulertal Binnakandi Grant, cuts off 35,814 residents if lost alone", "295 of 1,136 segments cut someone off if lost alone", "Dalu Grant is cut off in 67% of floods"] },
  { at: 165, title: "Live: one severe flood", to: "/calculator",
    calc: { floodMode: "preset", preset: "severe_11", trucks: 4, hubConfig: "three", policy: "access_opt", tab: "overview", tool: "pan" },
    say: "Now one severe flood. Red roads are cut. This is who loses access, and what we send where.",
    numbers: ["44% of road cut, 15 of 87 facilities out of service", "715,833 residents (44.1%) cut off", "Mean travel time 11.6 to 15.8 min for those still connected"] },
  { at: 210, title: "Methods compared against what an officer would do", to: "/calculator",
    calc: { tab: "methods" },
    say: "We compare against rules a district officer would use. The big gain is information: knowing who each facility now serves after the flood.",
    numbers: ["Blind nearest-first 6,455 unmet vs informed 5,103 in this flood", "Over 60 floods: 2,296 fewer unmet units, 95% CI 2,035 to 2,561, better in every flood", "The optimiser adds value only when trucks are scarce"] },
  { at: 240, title: "Preventive action: pre-position stock", to: "/calculator",
    calc: { hubConfig: "single", tab: "overview" },
    say: "The most useful finding. A single depot at Silchar is cut off from most facilities in many floods. Switch to three pre-positioned hubs and watch the reach change.",
    numbers: ["Held-out floods: single depot isolated in 67%, three hubs in 10%", "72% vs 45% of facilities reachable", "Severe-flood unmet demand 7,314 to 5,136 units"] },
  { at: 270, title: "Honesty: what holds and what is fragile", to: "/evidence", anchor: "robustness",
    say: "Everything about stock and floods is generated, so these are method results, not measurements. Conclusions hold under sensitivity tests; the exact top-10 village list is the fragile part.",
    numbers: ["Cut-off share moves by under 1 point with 20% of roads missing", "Top-10 worst-hit list overlaps 57% to 80%", "Replace generated stock and floods with district records and dated NRSC maps"] },
];
