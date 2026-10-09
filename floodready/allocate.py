"""Allocate limited depot stock to health facilities after a flood, and compare policies.

Model (all parameters are assumptions, see datasets/synthetic/ASSUMPTIONS.md):
  * demand of a facility = residents it serves x RATE x HORIZON_DAYS; unmet demand = what its stock plus deliveries
    cannot cover;
  * deliveries come from one depot; a trip to facility i costs round-trip hours on the *damaged* road graph, and the fleet
    has trucks x TRUCK_HOURS_PER_DAY x HORIZON_DAYS truck-hours; a facility out of service or unreachable gets nothing;
  * policies: none; proportional (to pre-flood population); nearest_first (fill pre-flood shortfalls, nearest first);
    access_lp (linear programme on the POST-flood shortfalls and travel times, using the access-loss assessment).
The baselines do not see the flood's effect on who each facility serves; that information is what the access-loss
assessment adds.
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import linprog
from scipy.sparse.csgraph import dijkstra

from .impact import Impact
from .network import District
from .scenarios import Scenario

RATE = 0.002             # treatment courses per person per day
HORIZON_DAYS = 14
TRUCK_CAPACITY = 3000.0  # units
TRUCK_HOURS_PER_DAY = 10.0
SERVICE_HOURS = 0.5      # loading/unloading per delivery
POLICIES = ("none", "proportional", "nearest_first", "access_lp")


@dataclass
class Plan:
    policy: str
    table: pd.DataFrame
    summary: dict


def _served(villages: pd.DataFrame, col: str, fac_ids) -> np.ndarray:
    pop = villages[villages[col] >= 0].groupby(col).population.sum()
    return pop.reindex(fac_ids).fillna(0).values


def plan(district: District, scenario: Scenario, impact: Impact, policy: str, trucks: int = 8,
         depot_stock: float = None, horizon: int = HORIZON_DAYS) -> Plan:
    fac, g = district.fac, district.graph
    ids = fac.facility_id.values
    working = ~np.isin(ids, list(scenario.out_facilities))
    stock = fac.stock_units.values.astype(float)
    if depot_stock is None:  # depot holds 10 days of district-wide demand (synthetic assumption)
        depot_stock = 10 * fac.demand_per_day.sum()
    d_pre = _served(impact.villages, "facility_before", ids) * RATE * horizon
    d_post = _served(impact.villages, "facility_after", ids) * RATE * horizon
    short_pre, short_post = np.maximum(d_pre - stock, 0), np.maximum(d_post - stock, 0)
    t = dijkstra(g.matrix(scenario.cut_segments), directed=False, indices=district.depot_node)[fac.node.values] + fac.access_min.values
    ok = working & np.isfinite(t)
    cost = np.where(ok, (2 * np.where(ok, t, 0) / 60 + SERVICE_HOURS) / TRUCK_CAPACITY, np.inf)  # truck-hours per unit
    budget = trucks * TRUCK_HOURS_PER_DAY * horizon
    q = np.zeros(len(ids))
    if policy == "proportional":
        w = np.where(ok, d_pre, 0.0)
        q0 = depot_stock * w / w.sum() if w.sum() else q
        spend = np.nansum(np.where(ok, q0 * cost, 0))
        q = q0 * min(1.0, budget / spend) if spend else q0
    elif policy == "nearest_first":
        left_b, left_s = budget, depot_stock
        for i in np.argsort(np.where(ok, t, np.inf)):
            if not ok[i] or left_b <= 0 or left_s <= 0:
                break
            x = min(short_pre[i], left_s, left_b / cost[i])
            q[i], left_b, left_s = x, left_b - x * cost[i], left_s - x
    elif policy == "access_lp":
        idx = np.flatnonzero(ok)
        if len(idx):
            res = linprog(-np.ones(len(idx)), A_ub=np.vstack([cost[idx], np.ones(len(idx))]), b_ub=[budget, depot_stock],
                          bounds=[(0, short_post[i]) for i in idx], method="highs")
            q[idx] = res.x
    elif policy != "none":
        raise ValueError(policy)
    unmet = np.where(working, np.maximum(d_post - stock - q, 0), 0)
    cut_units = impact.summary["pop_cut_off"] * RATE * horizon
    table = pd.DataFrame({"facility_id": ids, "name": fac.name.values, "working": working, "depot_minutes": t,
                          "stock": stock, "demand_post": d_post, "shortfall_post": short_post, "deliver": q, "unmet": unmet})
    summary = {"policy": policy, "scenario": scenario.name, "severity": scenario.severity, "trucks": trucks,
               "unmet_units": float(unmet.sum()), "cut_off_units": float(cut_units), "total_unmet_units": float(unmet.sum() + cut_units),
               "delivered": float(q.sum()), "truck_hours": float(np.nansum(np.where(ok, q * cost, 0))),
               "facilities_stocked_out": int((unmet > 0).sum())}
    return Plan(policy=policy, table=table, summary=summary)
