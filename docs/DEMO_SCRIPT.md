# Demo script: 5 minutes of a 10-minute presentation

Order: the data first (landing page), then the estimates. Every figure is in `results/figures/`; every number is in
`results/METRICS.md`. Live command for the middle section: `python -m floodready demo --scenario severe_11 --trucks 4 --map results/demo_map.png`.

| Time | Screen | What to say | Numbers to quote |
|---|---|---|---|
| 0:00 | Landing: ingestion (L1) | "We started from official open data: the PMGSY rural-roads dataset for Cachar. The facility layer needed cleaning." | 119 "Medical" entries, 32 veterinary removed, 87 human-health facilities |
| 0:30 | Profile (L2, L3, L4) | "This is the district: how many people, how much road, how far people are from care before any flood." | 1,188 villages; 1.62 M residents; 3,525 km; median 10 min, 90th percentile 24 min to a facility; 63,853 residents over 30 min away |
| 1:15 | Data quality (L5, L6) | "The roads were not connected: 211 fragments. We split lines at junctions and snap within 10 m. We also found the load is uneven." | 98.7% of segments joined; 11 facilities serve nobody; one serves 108,804 residents; circuity 1.37 (plausible) |
| 2:00 | Exposure (L8) | "Before any scenario: which villages and which roads are most exposed across 60 simulated floods?" | 283 villages cut off in half or more of floods (360,902 residents); one road (Fulertal Binnakandi Grant) cuts off 35,814 residents if lost; 295 of 1,136 segments cut someone off if lost alone |
| 2:45 | Live demo, one flood (map + terminal) | "Now one severe flood. Red roads are cut. This is who loses access and what we send where." | 44% of road cut; 15 of 87 facilities out; 715,833 residents (44.1%) cut off; travel 11.6 to 15.8 min |
| 3:30 | Method comparison (R1, R2) | "We compare against rules an officer would use. The big gain is information: knowing who each facility now serves." | Blind nearest-first 6,455 unmet vs informed 5,103 in this flood; optimiser adds value only when trucks are scarce (1 truck: 3,870 vs 5,806) |
| 4:00 | Preventive action (R3) | "The most useful finding: a single depot is isolated in two thirds of unseen floods. Three pre-positioned hubs cut that to a tenth." | 72% vs 45% of facilities reachable; isolated in 10% vs 67% of held-out floods; severe unmet 7,314 to 5,136 |
| 4:30 | Honesty (R4, R5) | "Everything about stock and floods is generated, so these are method results. Conclusions hold under sensitivity tests; the exact top-10 villages are the fragile part." | Cut-off share moves by under 1 point with 20% missing roads; top-10 list overlaps 57% to 80% |

## Likely questions

- **Why not just serve the nearest facility first?** It does as well as anything once it knows the flood's effect; the blind version does not (6,455 vs 5,103 unmet in the demo flood; paired test over 60 floods: mean 2,296 fewer units, 95% CI 2,035 to 2,561, better in every flood).
- **So is the optimiser pointless?** With 4 or more trucks it ties with informed nearest-first. It helps when trucks are scarce: 1 truck, 3,870 vs 5,806 units; 2 trucks, 18% of floods improve (mean 32 units).
- **Why is so much still unmet?** Because it is unreachable by road: 20,043 units sit in cut-off villages in the demo flood. That is the case for pre-positioning stock at facilities and for non-road access (boats).
- **Is the data real?** Roads, villages, population and facilities are official PMGSY data (July 2022 snapshot, via a public mirror). Stock, depot, fleet and flood extents are generated, flagged and documented.
- **How do you know the network is right?** Circuity of 1.37, residents conserved, cut-off share rises with severity, and results are stable when 20% of roads are removed (cut-off share moves by under 1 point).
- **What would change with real data?** Replace generated stock with district records and generated flood extents with dated NRSC inundation maps; the pipeline is otherwise unchanged.

## Before presenting

1. Run `python -m floodready demo --scenario severe_11 --trucks 4 --map results/demo_map.png` once so nothing is cold.
2. Keep `results/figures/` open in order L1 to L8, R1 to R5.
3. Have a screenshot of the demo output ready in case the terminal fails.
