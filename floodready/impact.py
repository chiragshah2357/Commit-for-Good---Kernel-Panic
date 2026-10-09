"""Access-loss assessment: how does a flood change each village's access to a working health facility?

For every village we compute the travel time to the nearest *working* facility before and after the flood, on the
damaged road graph. A village is "cut off" if the flood leaves it with no reachable working facility (villages already unreachable without a
flood are reported separately as "unconnected"), and "delayed" if its
travel time grows by DELAY_MIN minutes or more.
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.sparse.csgraph import dijkstra

from .network import District
from .scenarios import NO_FLOOD, Scenario

DELAY_MIN = 30.0


def _nearest_facility(district: District, scenario: Scenario):
    """Travel time (minutes, graph part only) from every node to its nearest working facility, and which facility."""
    g, fac = district.graph, district.fac
    working = np.flatnonzero(~fac.facility_id.isin(scenario.out_facilities).values)
    nodes = fac.node.values[working]
    dist, _, src = dijkstra(g.matrix(scenario.cut_segments), directed=False, indices=nodes, min_only=True, return_predecessors=True)
    fac_at = np.full(g.n_nodes, -1)
    for k in range(len(working) - 1, -1, -1):  # lowest index wins when facilities share a node
        fac_at[nodes[k]] = working[k]
    nearest = np.where(src >= 0, fac_at[np.clip(src, 0, None)], -1)
    return dist, nearest


@dataclass
class Impact:
    scenario: Scenario
    villages: pd.DataFrame   # one row per village
    summary: dict

    def ranking(self, n=10):
        """Villages ordered by who is worst hit: cut off first, then by residents affected and added travel time."""
        v = self.villages
        hit = v[v.cut_off | (v.delay_min >= DELAY_MIN)]
        return hit.sort_values(["cut_off", "population", "delay_min"], ascending=False).head(n)


def assess(district: District, scenario: Scenario = NO_FLOOD, before=None) -> Impact:
    """before: optional precomputed result of the no-flood case (saves one shortest-path run)."""
    h, fac = district.hab, district.fac
    if before is None:
        b_dist, b_near = _nearest_facility(district, NO_FLOOD)
    else:
        b_dist, b_near = before
    a_dist, a_near = _nearest_facility(district, scenario)
    t_before = b_dist[h.node.values] + h.access_min.values
    t_after = a_dist[h.node.values] + h.access_min.values
    unconnected = ~np.isfinite(t_before)            # not reachable even without a flood (data gap, not flood damage)
    cut = np.isfinite(t_before) & ~np.isfinite(t_after)  # newly cut off by this flood
    with np.errstate(invalid="ignore"):  # inf - inf for villages that are unreachable both before and after
        delay = np.where(cut, np.inf, np.where(unconnected, np.nan, t_after - t_before))
    v = pd.DataFrame({
        "hab_id": h.hab_id.values, "name": h.name.values, "population": h.population.values,
        "time_before_min": t_before, "time_after_min": t_after, "delay_min": delay, "cut_off": cut, "unconnected": unconnected,
        "facility_before": np.where(b_near[h.node.values] >= 0, fac.facility_id.values[np.clip(b_near[h.node.values], 0, None)], -1),
        "facility_after": np.where(a_near[h.node.values] >= 0, fac.facility_id.values[np.clip(a_near[h.node.values], 0, None)], -1),
    })
    pop = v.population.sum()
    ok = ~v.cut_off & ~v.unconnected
    summary = {
        "scenario": scenario.name, "severity": scenario.severity,
        "population": int(pop),
        "pop_cut_off": int(v.population[v.cut_off].sum()),
        "share_cut_off": float(v.population[v.cut_off].sum() / pop),
        "pop_delayed": int(v.population[(v.delay_min >= DELAY_MIN)].sum()),
        "villages_cut_off": int(v.cut_off.sum()),
        "pop_unconnected_baseline": int(v.population[v.unconnected].sum()),
        "mean_time_before_min": float(np.average(v.time_before_min[ok], weights=v.population[ok])) if ok.any() else float("nan"),
        "mean_time_after_min": float(np.average(v.time_after_min[ok], weights=v.population[ok])) if ok.any() else float("nan"),
        "facilities_out": len(scenario.out_facilities),
    }
    return Impact(scenario=scenario, villages=v, summary=summary)


def baseline(district: District):
    """Precompute the no-flood nearest-facility distances, to pass as `before=` when assessing many scenarios."""
    return _nearest_facility(district, NO_FLOOD)
