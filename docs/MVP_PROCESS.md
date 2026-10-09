# MVP process: Flood-Ready Access

Status on 9 Oct 2026: the core pipeline runs end to end in Python (network, access-loss, allocation). The evaluation
harness, command-line demo and map are not built yet (section 6).

## 1. What the MVP does

Given a flood scenario for Cachar district, it answers three questions:

1. **Which villages lose access to a working health facility, and by how much?** (access-loss assessment)
2. **How much stock is left unmet if deliveries are allocated by simple rules?** (baselines)
3. **How much less is unmet if allocation uses the flood's effect on who each facility serves?** (access-aware plan)

## 2. How it works

| Step | Module | PR | What happens |
|---|---|---|---|
| 1. Data | `datasets/` | #4 (merged) | Real PMGSY roads, villages, facilities; generated stock, depot, fleet and 60 flood scenarios (seed 42) |
| 2. Network | `floodready/network.py` | #5 | Split road lines at crossings and T-junctions, merge endpoints within 10 m, keep each edge's original segment id, attach villages, facilities and depot to nodes |
| 3. Access loss | `floodready/impact.py` | #6 | Remove cut segments and out-of-service facilities; multi-source shortest path to the nearest working facility; flag cut-off and delayed villages; rank |
| 4. Allocation | `floodready/allocate.py` | #7 | Four policies over the damaged graph, bounded by depot stock and a truck-hour budget |

PRs #5, #6 and #7 are **stacked**: each is based on the previous branch. Merge them in order (5, then retarget 6 to
`main`, and so on).

## 3. How we got here (decisions and fixes)

- **Audit first.** The raw road lines were not joined (211 components). Endpoint snapping alone reached 90.4% of segments.
- **Better than the audit.** Splitting lines at T-junctions as well lifted the largest network to **98.7%** of segments
  and put all 87 facilities on it. Edge ids are preserved so a scenario can cut a whole original road.
- **"Cut off" was redefined during testing.** Some villages (0.9% of residents) are unreachable even without a flood, which
  is a data gap, not flood damage. They are now reported as `unconnected` and excluded from "cut off".
- **Edge cases found by tests.** A toy district where every village is cut off crashed the weighted average; fixed with a guard.
- **Allocation compares against honest baselines.** The baselines do not see the flood's effect on who each facility serves;
  that information is what the assessment adds. We did not use a stronger solver to create the gain.
- **A tool choice changed.** OR-Tools is not installed, so the access-aware plan uses scipy's linear programming (HiGHS).
  A vehicle-routing refinement is future work.

## 4. Results so far (Cachar; 20 generated scenarios per severity; means)

| Severity | Residents cut off | Facilities out | Unmet units: none | proportional | nearest-first | **access-aware** |
|---|---|---|---|---|---|---|
| mild | 3.2% | 1.3 | 11,799 | 1,933 | 2,958 | **123** |
| moderate | 22.4% | 8.1 | 11,901 | 8,362 | 9,243 | **8,208** |
| severe | 45.8% | 16.3 | 7,820 | 7,325 | 7,402 | **7,314** |

Villages cut off entirely add roughly 1,465 / 10,182 / 20,805 units of demand that no allocation can serve.

## 5. Honest reading

- The access-aware plan is the best in every case, but the gain **shrinks as floods worsen**, because most unmet demand
  then sits in cut-off villages. Allocation helps most when roads are damaged but not gone.
- **Fleet size (2, 4 or 8 trucks) made no difference.** Depot stock, not truck time, is the binding limit under the current assumptions.
- Everything runs on **generated** stock, demand, depot, fleet and flood extents. These results show that the method works
  under stated assumptions; they are not findings about real floods in Cachar.
- Travel speeds by road class and the first/last-leg speed are assumptions. A "14-day horizon" and "0.002 courses per person
  per day" are also assumptions (see `datasets/synthetic/ASSUMPTIONS.md`).
- No sensitivity analysis has been run yet beyond fleet size.

## 6. What is left for a demo

| Branch | Work |
|---|---|
| `test/baseline-evaluation` | Run all 60 scenarios x policies, write `results/evaluation.csv`, box plot of unmet demand, sensitivity over stock and horizon |
| `feat/cli-demo` | `python -m floodready demo --scenario severe_11` printing the ranked villages and the allocation plan, and a map of cut roads |
| `docs/readme-run-steps` | Installation and usage in the README, example output, fresh-clone check |
| (not code) | 2 to 3 minute demo video; deck slide for the demo |

## 7. Run it now

```python
# from the repository root, with requirements installed
from floodready.network import load_cachar
from floodready.impact import assess, baseline
from floodready.scenarios import load_scenarios
from floodready.allocate import plan

district, scenarios = load_cachar(), load_scenarios()
impact = assess(district, scenarios["severe_11"], baseline(district))
print(impact.summary)             # residents cut off, delayed, mean travel time
print(impact.ranking(10))         # worst-hit villages
print(plan(district, scenarios["severe_11"], impact, "access_lp").summary)
```

Tests: `pytest` (14 pass).
