"""Evaluation of the flood-access pipeline over the generated scenarios: metrics, statistics, sensitivity, robustness and validation.

Everything here is computed on GENERATED flood scenarios and stock (datasets/synthetic), so results show how the method behaves
under stated assumptions; they are not measurements of a real flood. Run:  python -m floodready evaluate
"""
import json
from dataclasses import replace
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.sparse.csgraph import dijkstra

from . import allocate
from .allocate import POLICIES, depot_times, plan
from .impact import DELAY_MIN, assess, baseline
from .metrics import bootstrap_ci, paired_summary, weighted_quantile
from .network import District, load_cachar
from .scenarios import NO_FLOOD, Scenario, load_scenarios

RESULTS = Path(__file__).resolve().parent.parent / "results"
SEVERITIES = ("mild", "moderate", "severe")
MAIN_POLICIES = ("none", "proportional", "nearest_first", "nearest_first_post", "access_opt")


# ---------------------------------------------------------------- core run
def access_row(imp, district, hubs=None):
    v, s = imp.villages, dict(imp.summary)
    ok = ~v.cut_off & ~v.unconnected
    for tag, col in (("before", "time_before_min"), ("after", "time_after_min")):
        s[f"median_time_{tag}_min"] = weighted_quantile(v[col][ok], v.population[ok], 0.5) if ok.any() else float("nan")
        s[f"p90_time_{tag}_min"] = weighted_quantile(v[col][ok], v.population[ok], 0.9) if ok.any() else float("nan")
    t, _ = depot_times(district, imp.scenario, hubs)
    working = ~district.fac.facility_id.isin(imp.scenario.out_facilities).values
    s["depot_reach_share"] = float(np.isfinite(t[working]).mean())
    s["depot_isolated"] = bool(s["depot_reach_share"] < 0.5)
    return s


def run_core(district: District, scenarios: dict, before=None, trucks=8, policies=POLICIES, hubs=None, **kw):
    before = before or baseline(district)
    imps = {n: assess(district, s, before) for n, s in scenarios.items()}
    access = pd.DataFrame([access_row(i, district, hubs) for i in imps.values()])
    alloc = pd.DataFrame([plan(district, scenarios[n], imps[n], p, trucks=trucks, hubs=hubs, **kw).summary for n in scenarios for p in policies])
    return access, alloc, imps


def stats_by_severity(alloc: pd.DataFrame, metrics=("unmet_units", "total_unmet_units", "capture_rate", "waste_share", "unmet_gini")):
    rows = []
    for sev in SEVERITIES:
        for pol in alloc.policy.unique():
            sub = alloc[(alloc.severity == sev) & (alloc.policy == pol)]
            for m in metrics:
                mean, lo, hi = bootstrap_ci(sub[m].values)
                rows.append({"severity": sev, "policy": pol, "metric": m, "mean": mean, "ci_low": lo, "ci_high": hi, "n": int(sub[m].notna().sum())})
    return pd.DataFrame(rows)


def paired_tests(alloc: pd.DataFrame, treatment="access_opt", references=("none", "proportional", "nearest_first", "nearest_first_post"),
                 metric="unmet_units"):
    rows = []
    for sev in SEVERITIES + ("all",):
        sub = alloc if sev == "all" else alloc[alloc.severity == sev]
        a = sub[sub.policy == treatment].set_index("scenario")[metric]
        for ref in references:
            b = sub[sub.policy == ref].set_index("scenario")[metric].reindex(a.index)
            rows.append({"severity": sev, "treatment": treatment, "reference": ref, "metric": metric, **paired_summary(a.values, b.values)})
    return pd.DataFrame(rows)


# ---------------------------------------------------------------- depot resilience (train / test split)
def split_scenarios(scenarios: dict):
    train = {n: s for n, s in scenarios.items() if int(n.split("_")[1]) < 10}
    test = {n: s for n, s in scenarios.items() if int(n.split("_")[1]) >= 10}
    return train, test


def hub_analysis(district: District, scenarios: dict, k=3):
    """Choose hub nodes that keep the most facilities reachable on TRAIN scenarios (greedy cover); report on TEST scenarios."""
    train, test = split_scenarios(scenarios)
    _, labels = district.graph.components()
    main = labels == np.bincount(labels).argmax()
    cands = np.unique(district.fac.node.values[main[district.fac.node.values]])
    fac_nodes = district.fac.node.values

    def reach(scen_dict, nodes):  # boolean (nodes, scenarios, facilities); out-of-service facilities count as unreachable
        out = np.zeros((len(nodes), len(scen_dict), len(fac_nodes)), bool)
        for j, s in enumerate(scen_dict.values()):
            work = ~district.fac.facility_id.isin(s.out_facilities).values
            d = dijkstra(district.graph.matrix(s.cut_segments), directed=False, indices=nodes)
            out[:, j, :] = np.isfinite(d[:, fac_nodes]) & work
        return out

    r_train = reach(train, cands)
    chosen, covered = [], np.zeros(r_train.shape[1:], bool)
    for _ in range(k):
        gain = [(r_train[c] & ~covered).mean() for c in range(len(cands))]
        c = int(np.argmax(gain)); chosen.append(c); covered |= r_train[c]
    hubs3 = tuple(int(cands[c]) for c in chosen)
    best1 = hubs3[0]
    work_test = lambda scen: np.array([~district.fac.facility_id.isin(s.out_facilities).values for s in scen.values()])
    configs = {"single depot (Silchar centre)": (district.depot_node,), "single resilient depot": (best1,), "three hubs": hubs3}
    rows = []
    for name, h in configs.items():
        for split, scen in (("train", train), ("test", test)):
            r = reach(scen, np.array(h)).any(axis=0)                 # reachable from at least one hub: (scenarios, facilities)
            w = work_test(scen)
            share = (r & w).sum(axis=1) / w.sum(axis=1)
            rows.append({"config": name, "hubs": len(h), "split": split, "mean_facilities_reachable_share": float(share.mean()),
                         "share_scenarios_isolated": float((share < 0.5).mean())})
    return pd.DataFrame(rows), configs


# ---------------------------------------------------------------- sensitivity sweeps
def sweep(district, scenarios, imps, param, values, policies=MAIN_POLICIES, hubs=None, trucks=4):
    base = 10 * district.fac.demand_per_day.sum()
    rows = []
    for v in values:
        kw = {"trucks": {"trucks": int(v)}, "depot_mult": {"depot_stock": base * v, "trucks": trucks}, "horizon": {"horizon": int(v), "trucks": trucks}, "rate": {"rate": allocate.RATE * v, "trucks": trucks}}[param]
        kw["hubs"] = hubs
        for n, s in scenarios.items():
            for p in policies:
                r = plan(district, s, imps[n], p, **kw).summary
                rows.append({"param": param, "value": v, "scenario": n, "severity": s.severity, "policy": p, "unmet_units": r["unmet_units"],
                             "capture_rate": r["capture_rate"], "truck_hours": r["truck_hours"], "truck_hour_budget": r["truck_hour_budget"]})
    return pd.DataFrame(rows)


def speed_sensitivity(district, scenarios, factors=(0.8, 1.0, 1.2)):
    rows = []
    for f in factors:
        d = replace(district, graph=replace(district.graph, minutes=district.graph.minutes / f))  # f x faster
        access, alloc, _ = run_core(d, scenarios, policies=("none", "access_opt"))
        rows.append({"speed_factor": f, "mean_time_after_min": access.mean_time_after_min.mean(),
                     "share_cut_off": access.share_cut_off.mean(),
                     "unmet_access_opt": alloc[alloc.policy == "access_opt"].unmet_units.mean(),
                     "truck_hours_access_opt": alloc[alloc.policy == "access_opt"].truck_hours.mean()})
    return pd.DataFrame(rows)


def snap_sensitivity(scenarios, tolerances=(5.0, 10.0, 25.0)):
    rows = []
    sub = {n: s for n, s in scenarios.items() if int(n.split("_")[1]) % 2 == 0}
    for t in tolerances:
        d = load_cachar(snap_m=t)
        n, labels = d.graph.components()
        big = np.bincount(labels).argmax()
        access, alloc, _ = run_core(d, sub, policies=("none", "access_opt"))
        rows.append({"snap_m": t, "nodes": d.graph.n_nodes, "components": int(n),
                     "segments_in_main_share": float(len(set(d.graph.seg_id[labels[d.graph.u] == big])) / d.roads.seg_id.nunique()),
                     "share_cut_off": access.share_cut_off.mean(), "unmet_access_opt": alloc[alloc.policy == "access_opt"].unmet_units.mean()})
    return pd.DataFrame(rows)


def robustness_dropout(district, scenarios, fractions=(0.05, 0.10, 0.20), reps=3, seed=42):
    """If a share of real roads is missing from our network data, how far do the headline numbers move?"""
    sub = {n: s for n, s in scenarios.items() if int(n.split("_")[1]) % 3 == 0}
    full_access, full_alloc, full_imps = run_core(district, sub, policies=("none", "access_opt"))
    ref_cut = full_access.set_index("scenario").share_cut_off
    seg_ids = np.sort(district.roads.seg_id.unique())
    rows = []
    for frac in fractions:
        for rep in range(reps):
            rng = np.random.default_rng([seed, int(frac * 100), rep])
            missing = frozenset(int(x) for x in rng.choice(seg_ids, size=int(frac * len(seg_ids)), replace=False))
            before = baseline(district, Scenario("missing", "none", cut_segments=missing))
            for n, s in sub.items():
                s2 = replace(s, name=f"{n}_drop{frac}_{rep}", cut_segments=s.cut_segments | missing)
                imp = assess(district, s2, before)
                top_full = set(full_imps[n].ranking(10).hab_id)
                top_new = set(imp.ranking(10).hab_id)
                a = plan(district, s2, imp, "access_opt").summary
                rows.append({"missing_share": frac, "rep": rep, "scenario": n, "share_cut_off": imp.summary["share_cut_off"],
                             "delta_cut_off_vs_full": imp.summary["share_cut_off"] - ref_cut[n],
                             "top10_overlap": len(top_full & top_new) / max(len(top_full | top_new), 1),
                             "unmet_access_opt": a["unmet_units"], "capture_rate": a["capture_rate"]})
    return pd.DataFrame(rows)


# ---------------------------------------------------------------- exposure analysis
def village_vulnerability(district, scenarios, imps):
    cut = pd.DataFrame({n: imps[n].villages.cut_off.values for n in scenarios})
    delay = pd.DataFrame({n: (imps[n].villages.delay_min.values >= DELAY_MIN) for n in scenarios})
    v = district.hab[["hab_id", "name", "population", "x", "y"]].copy()
    v["cut_off_freq"], v["delayed_freq"] = cut.mean(axis=1).values, delay.mean(axis=1).values
    for sev in SEVERITIES:
        cols = [n for n, s in scenarios.items() if s.severity == sev]
        v[f"cut_off_freq_{sev}"] = cut[cols].mean(axis=1).values
    v["expected_residents_cut_off"] = v.population * v.cut_off_freq
    return v.sort_values("expected_residents_cut_off", ascending=False)


def segment_criticality(district, before):
    """Remove each original road segment alone: how many residents lose access, and how much extra travel do others face?"""
    rows, h = [], district.hab
    base = assess(district, NO_FLOOD, before)
    base_pm = float((base.villages.time_before_min * base.villages.population)[~base.villages.unconnected].sum())
    roads = district.roads.set_index("seg_id")
    for sid in roads.index:
        imp = assess(district, Scenario(f"seg{sid}", "single", cut_segments=frozenset({int(sid)})), before)
        v = imp.villages
        ok = ~v.cut_off & ~v.unconnected
        extra = float(((v.time_after_min - v.time_before_min) * v.population)[ok].sum())
        rows.append({"seg_id": int(sid), "road_name": roads.loc[sid, "RoadName"], "category": roads.loc[sid, "RoadCatego"],
                     "owner": roads.loc[sid, "RoadOwner"], "length_km": float(roads.loc[sid, "length_m"] / 1000),
                     "residents_cut_off": imp.summary["pop_cut_off"], "extra_person_minutes": extra})
    df = pd.DataFrame(rows)
    df["extra_pm_share_of_total"] = df.extra_person_minutes / base_pm
    return df.sort_values(["residents_cut_off", "extra_person_minutes"], ascending=False)


# ---------------------------------------------------------------- validation checks
def validation(district, scenarios, before):
    g, h, f = district.graph, district.hab, district.fac
    out = {}
    # V1 circuity: road distance / straight-line distance from each village to its nearest facility (road metric)
    dlen, _, src = dijkstra(g.matrix(weight="length_m"), directed=False, indices=f.node.values, min_only=True, return_predecessors=True)
    ok = np.isfinite(dlen[h.node.values])
    from scipy.spatial import cKDTree
    eu, _ = cKDTree(np.c_[f.x, f.y]).query(np.c_[h.x, h.y])
    ratio = (dlen[h.node.values] + 1.0)[ok] / (eu[ok] + 1.0)
    out["circuity_median"] = float(np.median(ratio))
    out["circuity_p90"] = float(np.quantile(ratio, 0.9))
    out["circuity_plausible_1_to_2"] = bool(1.0 <= np.median(ratio) <= 2.0)
    # V2 agreement between nearest facility by road time and by straight line (the synthetic stock used straight-line catchments)
    _, nearest_eu = cKDTree(np.c_[f.x, f.y]).query(np.c_[h.x, h.y])
    imp = assess(district, NO_FLOOD, before)
    fid = imp.villages.facility_before.values
    same = (fid == f.facility_id.values[nearest_eu]) & ok
    out["nearest_facility_agreement_pop_weighted"] = float(h.population.values[same].sum() / h.population.values[ok].sum())
    # V3 conservation: residents assigned to facilities equal connected residents
    out["pop_assigned_equals_connected"] = bool(imp.villages[imp.villages.facility_before >= 0].population.sum() == h.population[~imp.villages.unconnected].sum())
    # V4 monotonicity: mean share cut off increases with severity
    means = {sev: float(np.mean([assess(district, s, before).summary["share_cut_off"] for s in scenarios.values() if s.severity == sev])) for sev in SEVERITIES}
    out["share_cut_off_by_severity"] = means
    out["severity_monotonic"] = bool(means["mild"] < means["moderate"] < means["severe"])
    # V5 determinism of the scenario file
    out["n_scenarios"] = len(scenarios)
    return out


# ---------------------------------------------------------------- orchestration
def main(results_dir=RESULTS):
    results_dir = Path(results_dir)
    results_dir.mkdir(exist_ok=True)
    district, scenarios = load_cachar(), load_scenarios()
    before = baseline(district)
    print("hub selection (train/test) ...")
    hubs_df, configs = hub_analysis(district, scenarios)
    hubs_df.to_csv(results_dir / "hub_resilience.csv", index=False)
    json.dump({k: list(v) for k, v in configs.items()}, open(results_dir / "hubs.json", "w"), indent=2)
    print("core evaluation across depot configurations and fleet sizes ...")
    allocs, accesses, tests = [], [], []
    imps = None
    for cname, h in configs.items():
        for tr in (2, 4, 8):
            access, alloc, imps_c = run_core(district, scenarios, before, trucks=tr, hubs=h)
            imps = imps or imps_c
            allocs.append(alloc.assign(config=cname, fleet=tr))
            if tr == 4:
                accesses.append(access.assign(config=cname))
            tests.append(paired_tests(alloc).assign(config=cname, fleet=tr))
    alloc_all = pd.concat(allocs)
    alloc_all.to_csv(results_dir / "allocation_by_scenario.csv", index=False)
    pd.concat(accesses).to_csv(results_dir / "access_by_scenario.csv", index=False)
    pd.concat(tests).to_csv(results_dir / "paired_tests.csv", index=False)
    stats = pd.concat([stats_by_severity(a).assign(config=a.config.iloc[0], fleet=a.fleet.iloc[0]) for a in allocs])
    stats.to_csv(results_dir / "allocation_stats.csv", index=False)
    print("sensitivity (three hubs) ...")
    h3 = configs["three hubs"]
    imps3 = run_core(district, scenarios, before, policies=("none",), hubs=h3)[2]
    sens = pd.concat([sweep(district, scenarios, imps3, "depot_mult", (0.25, 0.5, 1, 1.5, 2), hubs=h3), sweep(district, scenarios, imps3, "horizon", (7, 14, 21, 28), hubs=h3),
                      sweep(district, scenarios, imps3, "trucks", (1, 2, 4, 8), hubs=h3), sweep(district, scenarios, imps3, "rate", (0.5, 1, 1.5, 2), hubs=h3)])
    sens.to_csv(results_dir / "sensitivity.csv", index=False)
    speed_sensitivity(district, scenarios).to_csv(results_dir / "sensitivity_speed.csv", index=False)
    print("network sensitivity ...")
    snap_sensitivity(scenarios).to_csv(results_dir / "sensitivity_snap.csv", index=False)
    print("robustness to missing roads ...")
    robustness_dropout(district, scenarios).to_csv(results_dir / "robustness_missing_roads.csv", index=False)
    print("exposure analysis ...")
    village_vulnerability(district, scenarios, imps).to_csv(results_dir / "village_vulnerability.csv", index=False)
    segment_criticality(district, before).to_csv(results_dir / "segment_criticality.csv", index=False)
    print("validation ...")
    val = validation(district, scenarios, before)
    json.dump(val, open(results_dir / "validation.json", "w"), indent=2)
    print("done:", sorted(p.name for p in results_dir.glob("*.csv")))
    return val
