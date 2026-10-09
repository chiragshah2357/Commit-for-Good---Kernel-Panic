"""What-if engine behind the web calculator.

One `Engine` loads the Cachar road graph once and answers questions about any flood and any delivery set-up:

  simulate     who loses access, what each of the five allocation methods delivers, the delivery routes and a truck schedule
  ensemble     the same set-up replayed on all 60 generated floods: means, bootstrap CIs, worst-10% average (CVaR), paired tests
  pareto       unmet demand as the fleet grows, and where adding trucks stops helping
  repair       which cut road segments, restored one at a time, would give the most residents their access back
  uncertainty  how much the answer moves if a share of real roads is missing from our data

Everything runs on the models in network, impact and allocate; nothing here changes how they work. Floods, stock, depot and fleet are
GENERATED (datasets/synthetic/ASSUMPTIONS.md), so every number is a method result under stated assumptions, not a measured outcome.
"""
import json
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, replace
from pathlib import Path

import numpy as np
import pandas as pd
from pyproj import Transformer
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree
from shapely.geometry import LineString

from . import allocate, score
from .allocate import DELIVERY_DAYS, POLICIES, SERVICE_HOURS, TRUCK_CAPACITY, TRUCK_HOURS_PER_DAY, depot_times, plan
from .floodgen import FloodFeatures, manual
from .impact import _nearest_facility, assess, baseline
from .metrics import bootstrap_ci, paired_summary, weighted_quantile
from .network import DATA, UTM, District, load_cachar
from .scenarios import NO_FLOOD, Scenario, load_scenarios

RESULTS = Path(__file__).resolve().parent.parent / "results"
LABELS = {"none": "Do nothing", "proportional": "Proportional", "nearest_first": "Nearest-first (blind)",
          "nearest_first_post": "Nearest-first (informed)", "access_opt": "Access-aware optimiser"}
STATUS = {"ok": 0, "delayed": 1, "cut_off": 2, "unconnected": 3}
TRUCK_STEPS = (1, 2, 3, 4, 5, 6, 8, 10, 12)


@dataclass(frozen=True)
class Setup:
    trucks: int = 4
    hubs: tuple = ()               # graph node ids of the stock hubs
    stock_mult: float = 1.0        # depot stock as a multiple of the baseline (10 days of district demand)
    horizon: int = 14              # days of demand the stock must cover
    rate_mult: float = 1.0         # demand rate as a multiple of the baseline 0.002 courses per person per day
    policy: str = "access_opt"
    speed: float = 1.0             # all road speeds multiplied by this
    delay_min: float = 30.0        # a village counts as delayed when its travel time grows by at least this many minutes

    def key(self, policy=False, trucks=True):
        return (self.trucks if trucks else None, self.hubs, round(self.stock_mult, 3), self.horizon, round(self.rate_mult, 3),
                self.policy if policy else None, round(self.speed, 3), self.delay_min)


class _Lru(OrderedDict):
    def __init__(self, size):
        super().__init__()
        self.size = size

    def put(self, k, v):
        self[k] = v
        self.move_to_end(k)
        while len(self) > self.size:
            self.popitem(last=False)
        return v


def _clean(x):
    """Make numpy / NaN / inf values safe for JSON."""
    if isinstance(x, dict):
        return {str(k): _clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_clean(v) for v in x]
    if isinstance(x, np.ndarray):
        return _clean(x.tolist())
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.floating, float)):
        return None if not np.isfinite(x) else float(x)
    if isinstance(x, (np.bool_,)):
        return bool(x)
    return x


class Engine:
    def __init__(self, data_dir=DATA):
        t0 = time.time()
        self.base = load_cachar(data_dir)
        self.scenarios = load_scenarios(data_dir)
        self.features = FloodFeatures(data_dir)
        self.summary = pd.read_csv(Path(data_dir) / "synthetic" / "scenario_summary.csv").set_index("scenario")
        f = RESULTS / "hubs.json"
        self.hub_sets = json.load(open(f)) if f.exists() else {}
        self.three_hubs = tuple(self.hub_sets.get("three hubs", (self.base.depot_node,)))
        self.to_ll = Transformer.from_crs(UTM, "EPSG:4326", always_xy=True)
        self.to_utm = Transformer.from_crs("EPSG:4326", UTM, always_xy=True)
        _, labels = self.base.graph.components()
        self.main_nodes = np.flatnonzero(labels == np.bincount(labels).argmax())
        self._tree = cKDTree(self.base.graph.node_xy[self.main_nodes])
        self._districts, self._before, self._imps = {}, {}, {}
        self._ens, self._pareto = _Lru(8), _Lru(8)
        self.lock = threading.RLock()
        self.road_len = self.base.roads.set_index("seg_id").length_m
        self.load_seconds = time.time() - t0

    # ------------------------------------------------------------------ set-up helpers
    def district(self, speed=1.0) -> District:
        speed = round(float(speed), 2)
        with self.lock:
            if speed not in self._districts:
                self._districts[speed] = self.base if speed == 1.0 else replace(self.base, graph=replace(self.base.graph, minutes=self.base.graph.minutes / speed))
            return self._districts[speed]

    def before(self, speed=1.0):
        speed = round(float(speed), 2)
        with self.lock:
            if speed not in self._before:
                self._before[speed] = baseline(self.district(speed))
            return self._before[speed]

    def impacts(self, speed=1.0):
        """Access assessment of all 60 preset floods (cached per speed)."""
        speed = round(float(speed), 2)
        with self.lock:
            if speed not in self._imps:
                d, b = self.district(speed), self.before(speed)
                self._imps[speed] = {n: assess(d, s, b) for n, s in self.scenarios.items()}
            return self._imps[speed]

    def nearest_node(self, lon, lat) -> int:
        x, y = self.to_utm.transform(lon, lat)
        return int(self.main_nodes[self._tree.query([x, y])[1]])

    def resolve_hubs(self, config="three", points=()) -> tuple:
        if config == "single":
            return (self.base.depot_node,)
        if config == "custom" and points:
            nodes = tuple(dict.fromkeys(self.nearest_node(lo, la) for lo, la in list(points)[:6]))
            return nodes or (self.base.depot_node,)
        return self.three_hubs

    def hub_points(self, hubs):
        xy = self.base.graph.node_xy[list(hubs)]
        lon, lat = self.to_ll.transform(xy[:, 0], xy[:, 1])
        return [{"node": int(n), "lon": round(float(a), 5), "lat": round(float(b), 5)} for n, a, b in zip(hubs, lon, lat)]

    def resolve_scenario(self, mode="preset", preset="severe_11", cut_segments=(), out_facilities=(), height_m=2.5, distance_m=600.0,
                         seed=42, outage_prob=0.5) -> Scenario:
        if mode == "preset":
            if preset not in self.scenarios:
                raise KeyError(f"unknown preset flood {preset!r}")
            return self.scenarios[preset]
        if mode == "parametric":
            return self.features.parametric(height_m, distance_m, seed, outage_prob)
        valid = set(self.base.roads.seg_id.astype(int))
        return manual([i for i in cut_segments if int(i) in valid], out_facilities)

    def plan_kwargs(self, d: District, s: Setup) -> dict:
        return dict(trucks=s.trucks, depot_stock=s.stock_mult * 10 * d.fac.demand_per_day.sum(), horizon=s.horizon,
                    rate=allocate.RATE * s.rate_mult, hubs=s.hubs)

    # ------------------------------------------------------------------ per-flood building blocks
    @staticmethod
    def village_status(v: pd.DataFrame, delay_min: float) -> np.ndarray:
        with np.errstate(invalid="ignore"):
            st = np.where((v.delay_min.values >= delay_min), STATUS["delayed"], STATUS["ok"])
        st = np.where(v.cut_off.values, STATUS["cut_off"], st)
        return np.where(v.unconnected.values, STATUS["unconnected"], st).astype(np.int8)

    def _index(self, d, imp, plan_, s: Setup, st, weights):
        v = imp.villages
        pop, unconn = int(imp.summary["population"]), int(imp.summary["pop_unconnected_baseline"])
        hit = int(v.population.values[(st == STATUS["delayed"]) | (st == STATUS["cut_off"])].sum())
        demand_total = (pop - unconn) * allocate.RATE * s.rate_mult * s.horizon
        t = plan_.table
        reach = float(np.isfinite(t.depot_minutes[t.working]).mean()) if t.working.any() else 0.0
        comp = score.components(pop, unconn, hit, demand_total, plan_.summary["total_unmet_units"], t, reach)
        return comp

    def access_block(self, imp, st) -> dict:
        v = imp.villages
        pop = v.population.values
        ok = (st == STATUS["ok"]) | (st == STATUS["delayed"])
        out = {"population": int(pop.sum()), "pop_cut_off": int(pop[st == STATUS["cut_off"]].sum()),
               "pop_delayed_only": int(pop[st == STATUS["delayed"]].sum()), "pop_unconnected": int(pop[st == STATUS["unconnected"]].sum()),
               "villages_cut_off": int((st == STATUS["cut_off"]).sum()), "villages_delayed": int((st == STATUS["delayed"]).sum())}
        out["share_cut_off"] = out["pop_cut_off"] / out["population"]
        out["share_delayed_only"] = out["pop_delayed_only"] / out["population"]
        w = pop[ok]
        for tag, col in (("before", "time_before_min"), ("after", "time_after_min")):
            t = v[col].values[ok]
            out[f"mean_{tag}"] = float(np.average(t, weights=w)) if ok.any() else None
            out[f"median_{tag}"] = weighted_quantile(t, w, 0.5) if ok.any() else None
            out[f"p90_{tag}"] = weighted_quantile(t, w, 0.9) if ok.any() else None
        return out

    def scenario_block(self, s: Scenario) -> dict:
        cut = sorted(s.cut_segments)
        km = float(self.road_len.reindex(cut).sum() / 1000)
        total_km = float(self.road_len.sum() / 1000)
        return {"name": s.name, "severity": s.severity, "cut_segments": cut, "out_facilities": sorted(s.out_facilities),
                "road_km_cut": km, "share_road_cut": km / total_km, "segments_cut": len(cut), "facilities_out": len(s.out_facilities)}

    def plan_block(self, d, imp, plan_, s: Setup, st, weights) -> dict:
        comp = self._index(d, imp, plan_, s, st, weights)
        out = dict(plan_.summary)
        out["index"] = score.index(comp, weights)
        out["label"] = LABELS[plan_.policy]
        return out

    def facility_rows(self, plan_, hub_of) -> list:
        t = plan_.table
        return [{"id": int(r.facility_id), "name": r.name, "working": bool(r.working), "depot_min": r.depot_minutes if np.isfinite(r.depot_minutes) else None,
                 "stock": float(r.stock), "demand": float(r.demand_post), "shortfall": float(r.shortfall_post), "deliver": float(r.deliver),
                 "unmet": float(r.unmet), "hub": int(hub_of[i])} for i, r in enumerate(t.itertuples())]

    def routes(self, d: District, scenario: Scenario, hubs, plan_, hub_of) -> list:
        """Delivery routes on the damaged graph, drawn along the real road geometry."""
        g = d.graph
        alive = ~np.isin(g.seg_id, list(scenario.cut_segments)) if scenario.cut_segments else np.ones(len(g.u), bool)
        _, pred = dijkstra(g.matrix(scenario.cut_segments), directed=False, indices=list(hubs), return_predecessors=True)
        e = pd.DataFrame({"a": np.minimum(g.u, g.v), "b": np.maximum(g.u, g.v), "m": g.minutes, "i": np.arange(len(g.u))})[alive]
        best = e.loc[e.groupby(["a", "b"]).m.idxmin()]
        lookup = {(int(a), int(b)): int(i) for a, b, i in zip(best.a, best.b, best.i)}
        out = []
        t = plan_.table
        for i in np.flatnonzero(t.deliver.values > 0):
            node, h = int(d.fac.node.values[i]), int(hub_of[i])
            path = [node]
            while path[-1] != hubs[h] and pred[h, path[-1]] >= 0:
                path.append(int(pred[h, path[-1]]))
            if path[-1] != hubs[h]:
                continue
            path = path[::-1]
            pts = []
            for a, b in zip(path[:-1], path[1:]):
                k = lookup.get((min(a, b), max(a, b)))
                if k is None:
                    continue
                shp = g.shapes[k] if g.shapes is not None else g.node_xy[[a, b]]
                if np.linalg.norm(shp[0] - g.node_xy[a]) > np.linalg.norm(shp[-1] - g.node_xy[a]):
                    shp = shp[::-1]
                pts.extend(shp.tolist() if not pts else shp[1:].tolist())
            if len(pts) < 2:
                continue
            line = LineString(pts).simplify(12)
            xs, ys = self.to_ll.transform(*np.asarray(line.coords).T)
            out.append({"facility_id": int(t.facility_id.values[i]), "hub": h, "units": float(t.deliver.values[i]),
                        "path": [[round(float(x), 5), round(float(y), 5)] for x, y in zip(xs, ys)]})
        return out

    @staticmethod
    def schedule(plan_, hub_of, trucks: int) -> dict:
        """Greedy (longest trip first) packing of the dedicated trips onto trucks. The optimiser constrains total truck-hours,
        not individual truck days, so this shows one feasible way to run the plan and flags if packing needs more time."""
        t = plan_.table
        trips = []
        for i in np.flatnonzero(t.deliver.values > 0):
            tm = t.depot_minutes.values[i]
            trips.append({"facility_id": int(t.facility_id.values[i]), "name": t.name.values[i], "units": float(t.deliver.values[i]),
                          "hours": float(2 * tm / 60 + SERVICE_HOURS), "hub": int(hub_of[i])})
        loads = [0.0] * trucks
        for trip in sorted(trips, key=lambda x: -x["hours"]):
            k = int(np.argmin(loads))
            trip.update(truck=k + 1, start=loads[k], end=loads[k] + trip["hours"])
            loads[k] += trip["hours"]
        cap = TRUCK_HOURS_PER_DAY * DELIVERY_DAYS
        return {"trips": sorted(trips, key=lambda x: (x["truck"], x["start"])), "day_hours": TRUCK_HOURS_PER_DAY, "days": DELIVERY_DAYS,
                "capacity_hours": cap, "loads": loads, "overflow_trips": int(sum(1 for x in trips if x["end"] > cap + 1e-9)),
                "truck_capacity_units": TRUCK_CAPACITY}

    def ranking(self, imp, st, n=10) -> list:
        v = imp.villages.assign(status=st)
        hit = v[(v.status == STATUS["cut_off"]) | (v.status == STATUS["delayed"])].copy()
        hit["cut"] = hit.status == STATUS["cut_off"]
        hit["d"] = hit.delay_min.replace([np.inf], np.nan).fillna(0)
        hit = hit.sort_values(["cut", "population", "d"], ascending=False).head(n)
        return [{"hab_id": int(r.hab_id), "name": r["name"], "population": int(r.population), "status": int(r.status),
                 "time_before": r.time_before_min, "time_after": r.time_after_min if np.isfinite(r.time_after_min) else None} for _, r in hit.iterrows()]

    # ------------------------------------------------------------------ 1. simulate one flood
    def simulate(self, scenario: Scenario, s: Setup, weights=None) -> dict:
        t0 = time.time()
        d, b = self.district(s.speed), self.before(s.speed)
        imp = assess(d, scenario, b)
        st = self.village_status(imp.villages, s.delay_min)
        kw = self.plan_kwargs(d, s)
        plans = {p: plan(d, scenario, imp, p, **kw) for p in POLICIES}
        _, hub_of = depot_times(d, scenario, s.hubs)
        blocks = {p: self.plan_block(d, imp, pl, s, st, weights) for p, pl in plans.items()}
        ch = plans[s.policy]
        nf_imp = assess(d, NO_FLOOD, b)
        nf_plan = plan(d, NO_FLOOD, nf_imp, "none", **kw)
        nf_idx = score.index(self._index(d, nf_imp, nf_plan, s, self.village_status(nf_imp.villages, s.delay_min), weights), weights)
        sm = plans["access_opt"].summary
        none_sm = plans["none"].summary
        decomposition = {
            "cut_off_villages": ch.summary["cut_off_units"], "unreachable_facilities": none_sm["none_unmet_units"] - none_sm["avoidable_units"],
            "reachable_not_served": ch.summary["unmet_units"] - (none_sm["none_unmet_units"] - none_sm["avoidable_units"]),
            "useful_delivered": ch.summary["useful_delivered"], "wasted": ch.summary["delivered"] - ch.summary["useful_delivered"],
            "removed_by_information": plans["nearest_first"].summary["unmet_units"] - plans["nearest_first_post"].summary["unmet_units"],
            "removed_by_optimisation": plans["nearest_first_post"].summary["unmet_units"] - sm["unmet_units"]}
        v = imp.villages
        return _clean({
            "scenario": self.scenario_block(scenario), "hubs": self.hub_points(s.hubs), "setup": {**s.__dict__, "hubs": list(s.hubs)},
            "access": self.access_block(imp, st),
            "villages": {"status": st, "time_before": v.time_before_min.values, "time_after": v.time_after_min.values,
                         "facility_after": v.facility_after.values},
            "policies": blocks, "chosen": {"policy": s.policy, "facilities": self.facility_rows(ch, hub_of),
                                           "routes": self.routes(d, scenario, s.hubs, ch, hub_of), "schedule": self.schedule(ch, hub_of, s.trucks)},
            "no_flood_index": nf_idx, "decomposition": decomposition, "ranking": self.ranking(imp, st),
            "weights": score.normalise(weights), "ms": int((time.time() - t0) * 1000)})

    # ------------------------------------------------------------------ 2. ensemble over the 60 floods
    def _ensemble_rows(self, s: Setup) -> pd.DataFrame:
        key = s.key(policy=False)
        with self.lock:
            if key in self._ens:
                return self._ens[key]
        d = self.district(s.speed)
        imps, kw, rows = self.impacts(s.speed), self.plan_kwargs(d, s), []
        for name, sc in self.scenarios.items():
            imp = imps[name]
            st = self.village_status(imp.villages, s.delay_min)
            for pol in POLICIES:
                pl = plan(d, sc, imp, pol, **kw)
                comp = self._index(d, imp, pl, s, st, None)
                rows.append({"scenario": name, "severity": sc.severity, "policy": pol, "unmet_units": pl.summary["unmet_units"],
                             "total_unmet_units": pl.summary["total_unmet_units"], "cut_off_units": pl.summary["cut_off_units"],
                             "capture_rate": pl.summary["capture_rate"], "share_cut_off": imp.summary["share_cut_off"],
                             **{f"c_{k}": v for k, v in comp.items()}})
        with self.lock:
            return self._ens.put(key, pd.DataFrame(rows))

    def ensemble(self, s: Setup, weights=None) -> dict:
        t0 = time.time()
        df = self._ensemble_rows(s).copy()
        w = score.normalise(weights)
        df["index"] = 100 * sum(w[k] * df[f"c_{k}"] for k in w)
        out = {"policies": {}, "by_severity": {}, "paired": [], "n": int(df.scenario.nunique())}
        worst = max(int(round(0.1 * df.scenario.nunique())), 1)
        for pol in POLICIES:
            sub = df[df.policy == pol]
            m, lo, hi = bootstrap_ci(sub.total_unmet_units.values)
            mu, ulo, uhi = bootstrap_ci(sub.unmet_units.values)
            im, ilo, ihi = bootstrap_ci(sub["index"].values)
            out["policies"][pol] = {"label": LABELS[pol], "total_unmet_mean": m, "total_unmet_lo": lo, "total_unmet_hi": hi,
                                    "unmet_mean": mu, "unmet_lo": ulo, "unmet_hi": uhi, "index_mean": im, "index_lo": ilo, "index_hi": ihi,
                                    "cvar10_total_unmet": float(np.sort(sub.total_unmet_units.values)[-worst:].mean()),
                                    "worst_total_unmet": float(sub.total_unmet_units.max()), "mean_capture": float(sub.capture_rate.mean())}
            out["by_severity"][pol] = {sev: float(sub[sub.severity == sev].total_unmet_units.mean()) for sev in ("mild", "moderate", "severe")}
        chosen = df[df.policy == s.policy].set_index("scenario")
        for ref in POLICIES:
            if ref == s.policy:
                continue
            r = df[df.policy == ref].set_index("scenario").reindex(chosen.index)
            out["paired"].append({"reference": ref, "label": LABELS[ref], **paired_summary(chosen.unmet_units.values, r.unmet_units.values)})
        out["scenarios"] = [{"name": n, "severity": r.severity, "total_unmet": r.total_unmet_units, "unmet": r.unmet_units, "index": r["index"],
                             "share_cut_off": r.share_cut_off} for n, r in chosen.iterrows()]
        out["policy"] = s.policy
        out["ms"] = int((time.time() - t0) * 1000)
        return _clean(out)

    # ------------------------------------------------------------------ 3. marginal value of trucks
    def pareto(self, scenario: Scenario, s: Setup, trucks_list=TRUCK_STEPS) -> dict:
        t0 = time.time()
        d, b = self.district(s.speed), self.before(s.speed)
        imp = assess(d, scenario, b)
        key = (s.key(policy=True, trucks=False), scenario.name, hash(scenario.cut_segments), hash(scenario.out_facilities))
        with self.lock:
            if key in self._pareto:
                return self._pareto[key]
        rows = []
        imps = self.impacts(s.speed)
        for k in trucks_list:
            kw = self.plan_kwargs(d, replace(s, trucks=k))
            p = plan(d, scenario, imp, s.policy, **kw).summary
            ens = [plan(d, sc, imps[n], s.policy, **kw).summary["total_unmet_units"] for n, sc in self.scenarios.items()]
            rows.append({"trucks": k, "unmet": p["unmet_units"], "total_unmet": p["total_unmet_units"], "truck_hours": p["truck_hours"],
                         "budget_hours": p["truck_hour_budget"], "visits": p["visits"], "ens_mean": float(np.mean(ens)), "ens_p90": float(np.quantile(ens, 0.9))})
        floor = rows[0]["ens_mean"]
        knee = rows[-1]["trucks"]
        for a, c in zip(rows[:-1], rows[1:]):
            if (a["ens_mean"] - c["ens_mean"]) < 0.01 * max(floor, 1.0):
                knee = a["trucks"]
                break
        res = _clean({"rows": rows, "knee": knee, "policy": s.policy, "ms": int((time.time() - t0) * 1000),
                      "rule": "first fleet size after which one more truck lowers the 60-flood mean unmet demand by less than 1% of the 1-truck value"})
        with self.lock:
            return self._pareto.put(key, res)

    # ------------------------------------------------------------------ 4. which road to repair first
    def repair(self, scenario: Scenario, s: Setup, top=10) -> dict:
        t0 = time.time()
        d, b = self.district(s.speed), self.before(s.speed)
        g, h = d.graph, d.hab
        nodes, acc, pop = h.node.values, h.access_min.values, h.population.values.astype(float)
        dist0, _ = _nearest_facility(d, scenario)
        t_before = b[0][nodes] + acc
        t0v = dist0[nodes] + acc
        cut_before = np.isfinite(t_before) & ~np.isfinite(t0v)
        rows = []
        roads = d.roads.set_index("seg_id")
        for sid in sorted(scenario.cut_segments):
            m = g.seg_id == sid
            a, bb, w = g.u[m], g.v[m], g.minutes[m]
            with np.errstate(invalid="ignore"):   # inf + w is inf; only an edge that can shorten a path matters
                helps = np.any((dist0[a] + w < dist0[bb] - 1e-9) | (dist0[bb] + w < dist0[a] - 1e-9))
            if not helps:
                continue
            dist1, _ = _nearest_facility(d, replace(scenario, cut_segments=scenario.cut_segments - {sid}))
            t1 = dist1[nodes] + acc
            regained = cut_before & np.isfinite(t1)
            both = np.isfinite(t0v) & np.isfinite(t1)
            with np.errstate(invalid="ignore"):
                saved = float(((t0v - t1) * pop)[both].sum())
            if regained.any() or saved > 1e-6:
                rows.append({"seg_id": int(sid), "road_name": roads.loc[sid, "RoadName"], "category": roads.loc[sid, "RoadCatego"],
                             "length_km": float(roads.loc[sid, "length_m"] / 1000), "residents_regained": int(pop[regained].sum()),
                             "person_minutes_saved": saved})
        rows.sort(key=lambda r: (-r["residents_regained"], -r["person_minutes_saved"]))
        return _clean({"rows": rows[:top], "candidates": len(rows), "cut_segments": len(scenario.cut_segments), "residents_cut_off": int(pop[cut_before].sum()),
                       "ms": int((time.time() - t0) * 1000)})

    # ------------------------------------------------------------------ 5. data-incompleteness band
    def uncertainty(self, scenario: Scenario, s: Setup, weights=None, missing_share=0.2, reps=24) -> dict:
        t0 = time.time()
        d = self.district(s.speed)
        seg_ids = np.sort(d.roads.seg_id.unique())
        kw = self.plan_kwargs(d, s)
        rows = []
        if len(allocate._depot_cache) > 4000:
            allocate._depot_cache.clear()
        for rep in range(reps):
            rng = np.random.default_rng([42, int(round(missing_share * 100)), rep])
            missing = frozenset(int(x) for x in rng.choice(seg_ids, size=int(missing_share * len(seg_ids)), replace=False))
            b = baseline(d, Scenario("missing", "none", cut_segments=missing))
            s2 = replace(scenario, name=f"{scenario.name}_miss{int(missing_share * 100)}_{rep}", cut_segments=scenario.cut_segments | missing)
            imp = assess(d, s2, b)
            st = self.village_status(imp.villages, s.delay_min)
            pl = plan(d, s2, imp, s.policy, **kw)
            idx = score.index(self._index(d, imp, pl, s, st, weights), weights)["value"]
            rows.append({"share_cut_off": imp.summary["share_cut_off"], "total_unmet": pl.summary["total_unmet_units"], "index": idx})
        df = pd.DataFrame(rows)
        q = lambda c: {"p05": float(df[c].quantile(0.05)), "p50": float(df[c].quantile(0.5)), "p95": float(df[c].quantile(0.95)),
                       "values": df[c].round(4).tolist()}
        return _clean({"missing_share": missing_share, "reps": reps, "share_cut_off": q("share_cut_off"), "total_unmet": q("total_unmet"),
                       "index": q("index"), "ms": int((time.time() - t0) * 1000)})

    # ------------------------------------------------------------------ preview of a parametric flood (cheap: no routing)
    def preview(self, scenario: Scenario) -> dict:
        d = self.base
        imp = assess(d, scenario, self.before(1.0))
        b = self.scenario_block(scenario)
        b["share_cut_off"] = imp.summary["share_cut_off"]
        b["pop_cut_off"] = imp.summary["pop_cut_off"]
        return _clean(b)

    def presets(self) -> list:
        out = []
        for name, s in self.scenarios.items():
            r = self.summary.loc[name]
            out.append({"name": name, "severity": s.severity, "height_m": float(r.flood_height_m), "distance_m": float(r.flood_distance_m),
                        "segments_cut": int(r.segments_cut), "share_road_cut": float(r.share_road_length_cut), "facilities_out": int(r.facilities_out)})
        return out
