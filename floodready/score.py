"""Flood-Access Resilience Index: one 0-100 number that summarises four things the model measures separately.

    RI = 100 x ( w_access x A + w_supply x S + w_equity x E + w_reach x R )

    A  access retained     share of connected residents still within DELAY_MIN extra minutes of a working facility (not cut off, not delayed)
    S  supply continuity   share of 14-day demand that is met (stock on hand plus deliveries); demand in cut-off villages counts as unmet
    E  equity              share of working facilities NOT left badly short (unmet demand above SHORT_LIMIT of their post-flood demand)
    R  hub reach           share of working facilities a stock hub can still reach by road

The weights are a judgement, not an estimate from data. They default to the values below and can be changed in the app; the index is a
decision-support summary for comparing options on the same flood, and it has not been validated against real outcomes. The four
components are always reported next to it so nothing is hidden inside the sum.
"""
import numpy as np

SHORT_LIMIT = 0.25
DEFAULT_WEIGHTS = {"access": 0.35, "supply": 0.35, "equity": 0.15, "reach": 0.15}
LABELS = {"access": "Access retained", "supply": "Supply continuity", "equity": "Equity", "reach": "Hub reach"}
FORMULA = {
    "access": "1 - (residents cut off or delayed) / (connected residents)",
    "supply": "1 - (unmet units + units in cut-off villages) / (14-day demand of connected residents)",
    "equity": "1 - (working facilities with unmet > 25% of demand) / (working facilities with demand)",
    "reach": "(working facilities reachable from a hub) / (working facilities)",
}


def normalise(weights=None) -> dict:
    w = {k: max(float((weights or {}).get(k, DEFAULT_WEIGHTS[k])), 0.0) for k in DEFAULT_WEIGHTS}
    s = sum(w.values())
    return {k: v / s for k, v in w.items()} if s > 0 else dict(DEFAULT_WEIGHTS)


def components(population: int, pop_unconnected: int, pop_hit: int, demand_total: float, total_unmet: float,
               table, reach_share: float) -> dict:
    """pop_hit = residents cut off or delayed. table = the plan table (columns working, demand_post, unmet)."""
    connected = max(population - pop_unconnected, 1)
    work = table[table.working & (table.demand_post > 0)]
    short = float(((work.unmet / work.demand_post) > SHORT_LIMIT).mean()) if len(work) else 0.0
    clip = lambda x: float(min(max(x, 0.0), 1.0))
    return {"access": clip(1 - pop_hit / connected), "supply": clip(1 - total_unmet / demand_total) if demand_total > 0 else 1.0,
            "equity": clip(1 - short), "reach": clip(reach_share)}


def index(comp: dict, weights=None) -> dict:
    w = normalise(weights)
    parts = {k: 100 * w[k] * comp[k] for k in w}
    return {"value": float(sum(parts.values())), "components": {k: float(v) for k, v in comp.items()}, "weights": w,
            "contributions": {k: float(v) for k, v in parts.items()}}


def band(value: float) -> str:
    return "robust" if value >= 80 else "strained" if value >= 60 else "degraded" if value >= 40 else "failing"
