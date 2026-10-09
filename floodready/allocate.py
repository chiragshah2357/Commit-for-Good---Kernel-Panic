"""Allocate limited depot stock to health facilities after a flood, and compare policies.

Model (all parameters are assumptions, see datasets/synthetic/ASSUMPTIONS.md):
  * demand of a facility = residents it serves x rate x horizon; unmet demand = what its stock plus deliveries cannot cover;
  * deliveries come from one depot and are made within DELIVERY_DAYS; each facility is served by one dedicated truck trip
    whose round-trip hours are computed on the *damaged* road graph; the fleet has trucks x TRUCK_HOURS_PER_DAY x DELIVERY_DAYS hours; a facility out of service or unreachable gets nothing.

Policies:
  none                 nothing delivered
  proportional         depot stock split in proportion to PRE-flood catchment population
  nearest_first        fill PRE-flood shortfalls, nearest facility first
  nearest_first_post   ablation: nearest-first, but on POST-flood shortfalls (the information the access-loss assessment adds)
  access_opt           integer programme choosing which facilities to visit, on POST-flood shortfalls and travel times
                       (information plus optimisation)

The baselines (proportional, nearest_first) do not see the flood's effect on who each facility serves. Comparing
nearest_first_post with access_opt separates the value of that information from the value of optimisation.
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import Bounds, LinearConstraint, milp
from scipy.sparse.csgraph import dijkstra

from .impact import Impact
from .metrics import gini
from .network import District
from .scenarios import Scenario

RATE = 0.002             # treatment courses per person per day
HORIZON_DAYS = 14        # days of demand the stock must cover
DELIVERY_DAYS = 3        # emergency window in which deliveries must be made
TRUCK_CAPACITY = 3000.0  # units
TRUCK_HOURS_PER_DAY = 10.0
SERVICE_HOURS = 0.5      # loading/unloading per delivery
POLICIES = ("none", "proportional", "nearest_first", "nearest_first_post", "access_opt")

_depot_cache = {}


@dataclass
class Plan:
    policy: str
    table: pd.DataFrame
    summary: dict


def depot_times(district: District, scenario: Scenario, hubs=None):
    """Minutes from the nearest reachable hub to every facility on the damaged graph, and which hub it is (cached)."""
    hubs = tuple(hubs) if hubs is not None else (district.depot_node,)
    key = (id(district), hubs, scenario.name, hash(scenario.cut_segments))
    if key not in _depot_cache:
        dist = dijkstra(district.graph.matrix(scenario.cut_segments), directed=False, indices=list(hubs))
        per = dist[:, district.fac.node.values] + district.fac.access_min.values        # (hubs, facilities)
        _depot_cache[key] = (per.min(axis=0), per.argmin(axis=0))
    return _depot_cache[key]


def _served(villages: pd.DataFrame, col: str, fac_ids) -> np.ndarray:
    pop = villages[villages[col] >= 0].groupby(col).population.sum()
    return pop.reindex(fac_ids).fillna(0).values


def plan(district: District, scenario: Scenario, impact: Impact, policy: str, trucks: int = 8,
         depot_stock: float = None, horizon: int = HORIZON_DAYS, rate: float = RATE, hubs=None) -> Plan:
    if policy not in POLICIES:
        raise ValueError(policy)
    fac = district.fac
    ids = fac.facility_id.values
    working = ~np.isin(ids, list(scenario.out_facilities))
    stock = fac.stock_units.values.astype(float)
    if depot_stock is None:  # depot holds 10 days of district-wide demand (synthetic assumption)
        depot_stock = 10 * fac.demand_per_day.sum()
    d_pre = _served(impact.villages, "facility_before", ids) * rate * horizon
    d_post = _served(impact.villages, "facility_after", ids) * rate * horizon
    short_pre, short_post = np.maximum(d_pre - stock, 0), np.maximum(d_post - stock, 0)
    hubs = tuple(hubs) if hubs is not None else (district.depot_node,)
    t, hub_of = depot_times(district, scenario, hubs)
    per_hub = depot_stock / len(hubs)            # stock is split equally between hubs
    ok = working & np.isfinite(t)
    visit_h = np.where(ok, 2 * np.where(ok, t, 0) / 60 + SERVICE_HOURS, np.inf)   # truck-hours for one dedicated trip to facility i
    budget = trucks * TRUCK_HOURS_PER_DAY * DELIVERY_DAYS
    q = np.zeros(len(ids))
    if policy == "proportional":
        for h in range(len(hubs)):
            m = ok & (hub_of == h)
            w = np.where(m, d_pre, 0.0)
            target = np.minimum(per_hub * w / w.sum(), TRUCK_CAPACITY) if w.sum() else np.zeros(len(ids))
            q[m] = target[m]
        left_b = budget
        for i in np.argsort(np.where(ok, t, np.inf)):      # visit nearest first while the truck-hours last
            if not ok[i] or q[i] <= 0:
                continue
            if visit_h[i] > left_b:
                q[i] = 0
                continue
            left_b -= visit_h[i]
    elif policy in ("nearest_first", "nearest_first_post"):
        need = short_pre if policy == "nearest_first" else short_post
        left_b, left_s = budget, np.full(len(hubs), per_hub)
        for i in np.argsort(np.where(ok, t, np.inf)):
            if not ok[i]:
                continue
            u = min(need[i], TRUCK_CAPACITY, left_s[hub_of[i]])
            if u <= 0 or visit_h[i] > left_b:
                continue
            q[i] = u
            left_b -= visit_h[i]
            left_s[hub_of[i]] -= u
    elif policy == "access_opt":   # choose which facilities to visit: maximise useful units under truck-hours and per-hub stock
        idx = np.flatnonzero(ok & (short_post > 0))
        if len(idx):
            u = np.minimum(short_post[idx], TRUCK_CAPACITY)
            rows = [visit_h[idx]] + [np.where(hub_of[idx] == h, u, 0.0) for h in range(len(hubs))]
            res = milp(-u, constraints=LinearConstraint(np.vstack(rows), -np.inf, [budget] + [per_hub] * len(hubs)),
                       integrality=np.ones(len(idx)), bounds=Bounds(0, 1))
            if res.x is not None:
                q[idx] = u * np.round(res.x)
    unmet = np.where(working, np.maximum(d_post - stock - q, 0), 0)
    cut_units = impact.summary["pop_cut_off"] * rate * horizon
    none_unmet = float(short_post[working].sum())          # unmet if nothing is delivered
    avoidable = float(short_post[ok].sum())                # the part deliveries could fix at all
    useful = float(np.minimum(q, short_post).sum())
    served_share = np.where(d_post > 0, unmet / np.where(d_post > 0, d_post, 1), 0)[working & (d_post > 0)]
    table = pd.DataFrame({"facility_id": ids, "name": fac.name.values, "working": working, "depot_minutes": t,
                          "stock": stock, "demand_post": d_post, "shortfall_post": short_post, "deliver": q, "unmet": unmet})
    summary = {"policy": policy, "scenario": scenario.name, "severity": scenario.severity, "trucks": trucks,
               "unmet_units": float(unmet.sum()), "cut_off_units": float(cut_units), "total_unmet_units": float(unmet.sum() + cut_units),
               "none_unmet_units": none_unmet, "avoidable_units": avoidable,
               "capture_rate": (none_unmet - float(unmet.sum())) / avoidable if avoidable > 0 else float("nan"),
               "delivered": float(q.sum()), "useful_delivered": useful,
               "waste_share": 1 - useful / float(q.sum()) if q.sum() > 0 else 0.0,
               "truck_hours": float(visit_h[q > 0].sum()), "truck_hour_budget": float(budget), "visits": int((q > 0).sum()), "hubs": len(hubs),
               "facilities_stocked_out": int((unmet > 0.5).sum()), "facilities_unreachable": int((working & ~np.isfinite(t)).sum()),
               "unmet_gini": gini(served_share)}
    return Plan(policy=policy, table=table, summary=summary)
