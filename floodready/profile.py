"""Data profile for the demo's landing page: what was ingested, how clean it is, and how access looks before any flood.

Every number here comes from REAL open data (PMGSY roads, villages, facilities), except the stock rows, which are generated.
Run:  python -m floodready profile
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.sparse.csgraph import dijkstra

from .impact import assess, baseline
from .metrics import weighted_quantile
from .network import District, load_cachar
from .scenarios import NO_FLOOD

RESULTS = Path(__file__).resolve().parent.parent / "results"
# Raw counts for Cachar before cleaning (from datasets/AUDIT.md; the cleaned layers only keep human-health facilities)
RAW_FACILITY_CATEGORIES = {"Transport/Admin": 351, "Education": 310, "Agro": 261, "Medical": 119}
MEDICAL_VETERINARY_REMOVED = 32
BANDS = [(3, 10), (10, 32), (32, 100), (100, 316), (316, 1000), (1000, 3200), (3200, 10000), (10000, 32000)]


def village_bands(hab: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for lo, hi in BANDS:
        m = (hab.population >= lo) & (hab.population < hi)
        rows.append({"band": f"{lo}-{hi}", "low": lo, "high": hi, "villages": int(m.sum()), "residents": int(hab.population[m].sum())})
    return pd.DataFrame(rows)


def road_summary(district: District) -> pd.DataFrame:
    r = district.roads.assign(km=district.roads.length_m / 1000)
    cat = r.groupby("RoadCatego").agg(segments=("seg_id", "count"), km=("km", "sum")).reset_index().sort_values("km", ascending=False)
    cat["share_km"] = cat.km / cat.km.sum()
    return cat


def access_baseline(district: District, before) -> tuple:
    imp = assess(district, NO_FLOOD, before)
    v = imp.villages
    ok = ~v.unconnected
    t, w = v.time_before_min[ok].values, v.population[ok].values
    cdf = pd.DataFrame({"minutes": [5, 10, 15, 20, 30, 45, 60, 90]})
    cdf["residents_within_share"] = [float(w[t <= m].sum() / w.sum()) for m in cdf.minutes]
    summary = {"mean_min": float(np.average(t, weights=w)), "median_min": weighted_quantile(t, w, 0.5), "p90_min": weighted_quantile(t, w, 0.9),
               "villages_over_30_min": int((t > 30).sum()), "residents_over_30_min": int(w[t > 30].sum()),
               "unconnected_villages": int(v.unconnected.sum()), "unconnected_residents": int(v.population[v.unconnected].sum())}
    return imp, cdf, summary


def catchments(district: District, imp) -> pd.DataFrame:
    v, fac = imp.villages, district.fac
    pop = v[v.facility_before >= 0].groupby("facility_before").population.sum().reindex(fac.facility_id).fillna(0).values
    df = pd.DataFrame({"facility_id": fac.facility_id.values, "name": fac.name.values, "residents_served": pop,
                       "stock_units": fac.stock_units.values, "demand_per_day": fac.demand_per_day.values})
    df["days_of_cover"] = np.where(df.demand_per_day > 0, df.stock_units / df.demand_per_day.replace(0, np.nan), np.nan)
    return df


def snap_audit(tolerances=(1.0, 5.0, 10.0, 25.0, 50.0)) -> pd.DataFrame:
    rows = []
    for t in tolerances:
        d = load_cachar(snap_m=t)
        n, lab = d.graph.components()
        big = np.bincount(lab).argmax()
        rows.append({"snap_m": t, "nodes": d.graph.n_nodes, "components": int(n),
                     "segments_in_main_share": float(len(set(d.graph.seg_id[lab[d.graph.u] == big])) / d.roads.seg_id.nunique()),
                     "residents_attached_share": float(d.hab.population[lab[d.hab.node] == big].sum() / d.hab.population.sum())})
    return pd.DataFrame(rows)


def main(results_dir=RESULTS):
    results_dir = Path(results_dir)
    results_dir.mkdir(exist_ok=True)
    district = load_cachar()
    before = baseline(district)
    h, fac = district.hab, district.fac
    imp, cdf, acc = access_baseline(district, before)
    cat = road_summary(district)
    catch = catchments(district, imp)
    bands = village_bands(h)
    snap = snap_audit()
    profile = {
        "ingestion": {"villages": len(h), "residents": int(h.population.sum()), "road_segments": int(district.roads.seg_id.nunique()),
                      "road_km": float(district.roads.length_m.sum() / 1000), "facility_categories_raw": RAW_FACILITY_CATEGORIES,
                      "medical_raw": RAW_FACILITY_CATEGORIES["Medical"], "veterinary_removed": MEDICAL_VETERINARY_REMOVED, "human_health_facilities": len(fac)},
        "villages": {"median_residents": float(h.population.median()), "min": int(h.population.min()), "max": int(h.population.max()),
                     "villages_over_3000": int((h.population > 3000).sum()), "residents_in_villages_over_3000_share": float(h.population[h.population > 3000].sum() / h.population.sum())},
        "facilities": {"per_100k_residents": float(len(fac) / h.population.sum() * 1e5), "median_residents_served": float(catch.residents_served.median()),
                       "p90_residents_served": float(catch.residents_served.quantile(0.9)), "max_residents_served": float(catch.residents_served.max()),
                       "zero_catchment": int((catch.residents_served == 0).sum()), "over_30k_residents": int((catch.residents_served > 30000).sum())},
        "access_before_flood": acc,
        "stock": {"median_days_of_cover": float(catch.days_of_cover.median()), "facilities_under_7_days": int((catch.days_of_cover < 7).sum()),
                  "facilities_under_14_days": int((catch.days_of_cover < 14).sum()), "total_demand_per_day": float(fac.demand_per_day.sum()),
                  "data_origin": "generated (datasets/synthetic/ASSUMPTIONS.md)"},
        "network": {"nodes": district.graph.n_nodes, "edges": int(len(district.graph.u)), "snap_m": 10.0,
                    "segments_in_main_share_at_10m": float(snap[snap.snap_m == 10.0].segments_in_main_share.iloc[0])},
    }
    json.dump(profile, open(results_dir / "profile.json", "w"), indent=2)
    bands.to_csv(results_dir / "profile_village_bands.csv", index=False)
    cat.to_csv(results_dir / "profile_road_categories.csv", index=False)
    cdf.to_csv(results_dir / "profile_access_cdf.csv", index=False)
    catch.to_csv(results_dir / "profile_catchments.csv", index=False)
    snap.to_csv(results_dir / "profile_snap_audit.csv", index=False)
    imp.villages.to_csv(results_dir / "profile_village_access.csv", index=False)
    print(json.dumps(profile, indent=2)[:1500])
    return profile
