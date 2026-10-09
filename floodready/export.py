"""Write the static data files the web app reads for its landing and evidence pages (web/public/data/*.json).

  geometry.json    roads (simplified), villages, facilities, rivers, hubs: everything needed to draw the maps
  scenarios.json   the 60 generated floods (cut road ids, facilities out) and one worked example for the landing page
  evidence.json    every table and series behind the evidence page figures, taken from results/*.csv and profile.json

Run after `evaluate` and `profile`:  python -m floodready export
Real versus generated is carried through: nothing here is a measurement of a real flood.
"""
import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
from shapely.geometry import LineString
from shapely.ops import unary_union

from .analytics import Engine, Setup
from .network import DATA, UTM

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "results"
OUT = ROOT / "web" / "public" / "data"
SEV = ("mild", "moderate", "severe")
SIMPLIFY_M = 8.0
# Round 1 audit of the raw road lines (datasets/AUDIT.md): snapping tolerance -> share of segments in the largest network, residents within 500 m, components
ROUND1_SNAP = [{"snap_m": 1, "segments": 18.7, "residents": 17.5, "components": 211}, {"snap_m": 10, "segments": 90.4, "residents": 88.0, "components": 173},
               {"snap_m": 25, "segments": 90.5, "residents": 88.1, "components": 166}, {"snap_m": 50, "segments": 90.6, "residents": 88.1, "components": 155},
               {"snap_m": 100, "segments": 92.2, "residents": 90.4, "components": 133}]


def _r(x, n=5):
    return round(float(x), n)


def _flat(coords, n=5):
    return [_r(v, n) for xy in coords for v in xy]


def geometry(eng: Engine) -> dict:
    d = eng.base
    roads = d.roads.sort_values("seg_id")
    out_roads = []
    for _, r in roads.iterrows():
        g = r.geometry.simplify(SIMPLIFY_M)
        lines = list(g.geoms) if g.geom_type == "MultiLineString" else [g]
        parts = []
        for ln in lines:
            xs, ys = eng.to_ll.transform(*np.asarray(ln.coords)[:, :2].T)
            parts.append(_flat(zip(xs, ys)))
        out_roads.append({"id": int(r.seg_id), "c": r.RoadCatego, "n": r.RoadName, "k": _r(r.length_m / 1000, 2), "p": parts})
    h, f = d.hab, d.fac
    hlon, hlat = eng.to_ll.transform(h.x.values, h.y.values)
    flon, flat = eng.to_ll.transform(f.x.values, f.y.values)
    dep = eng.to_ll.transform(*d.graph.node_xy[d.depot_node])
    # district footprint: a concave hull of the road network, used to draw the district shape and to clip rivers to it
    utm_roads = unary_union(list(roads.geometry))
    hull = shapely.concave_hull(utm_roads, ratio=0.12).buffer(1500).simplify(250)
    hx, hy = eng.to_ll.transform(*np.asarray(hull.exterior.coords).T)
    rivers = []
    wf = DATA / "raw" / "osm_waterways" / "waterways_cachar_bbox.json"
    if wf.exists():
        clip = hull.buffer(800)
        for e in json.load(open(wf, encoding="utf-8"))["elements"]:
            tags = e.get("tags", {})
            k = tags.get("waterway")
            if k in ("river", "canal") or (k == "stream" and tags.get("name")):
                pts = [(p["lon"], p["lat"]) for p in e["geometry"]]
                if len(pts) < 2:
                    continue
                ln = gpd.GeoSeries([LineString(pts)], crs="EPSG:4326").to_crs(UTM).iloc[0].intersection(clip)
                for part in (list(ln.geoms) if hasattr(ln, "geoms") else [ln]):
                    if part.geom_type == "LineString" and part.length > 300:
                        xs, ys = eng.to_ll.transform(*np.asarray(part.simplify(30).coords)[:, :2].T)
                        rivers.append({"k": k, "n": tags.get("name", ""), "p": _flat(zip(xs, ys))})
    allx = np.concatenate([[v for r in out_roads for part in r["p"] for v in part[0::2]], hlon])
    ally = np.concatenate([[v for r in out_roads for part in r["p"] for v in part[1::2]], hlat])
    return {"bounds": [_r(allx.min()), _r(ally.min()), _r(allx.max()), _r(ally.max())], "roads": out_roads, "rivers": rivers, "hull": _flat(zip(hx, hy)),
            "villages": {"id": h.hab_id.astype(int).tolist(), "name": h.name.tolist(), "pop": h.population.astype(int).tolist(),
                         "lon": [_r(v) for v in hlon], "lat": [_r(v) for v in hlat]},
            "facilities": {"id": f.facility_id.astype(int).tolist(), "name": f.name.tolist(), "lon": [_r(v) for v in flon], "lat": [_r(v) for v in flat],
                           "stock": [round(float(v)) for v in f.stock_units], "demand": [_r(v, 1) for v in f.demand_per_day]},
            "depot": {"lon": _r(dep[0]), "lat": _r(dep[1]), "node": int(d.depot_node)},
            "hubs": {"single": eng.hub_points(eng.resolve_hubs("single")), "three": eng.hub_points(eng.three_hubs)}}


def scenarios(eng: Engine) -> dict:
    out = []
    for p in eng.presets():
        s = eng.scenarios[p["name"]]
        out.append({**p, "cut": sorted(s.cut_segments), "out": sorted(s.out_facilities)})
    s = Setup(trucks=4, hubs=eng.three_hubs)
    sim = eng.simulate(eng.scenarios["severe_11"], s)
    hero = {"scenario": "severe_11", "access": sim["access"], "status": sim["villages"]["status"], "scenario_block": {k: v for k, v in sim["scenario"].items() if k not in ("cut_segments", "out_facilities")},
            "policies": {k: {"unmet_units": v["unmet_units"], "total_unmet_units": v["total_unmet_units"], "visits": v["visits"], "index": v["index"]["value"]} for k, v in sim["policies"].items()}}
    return {"presets": out, "hero": hero}


def _rows(df, cols=None, nd=4):
    df = df if cols is None else df[cols]
    return json.loads(df.round(nd).to_json(orient="records"))


def evidence() -> dict:
    R = RESULTS
    prof = json.load(open(R / "profile.json"))
    val = json.load(open(R / "validation.json"))
    summ = pd.read_csv(DATA / "synthetic" / "scenario_summary.csv")
    stats = pd.read_csv(R / "allocation_stats.csv")
    stats = stats[stats.metric.isin(["unmet_units", "total_unmet_units"])]
    alloc = pd.read_csv(R / "allocation_by_scenario.csv")
    decomp = alloc.groupby(["config", "fleet", "severity", "policy"]).agg(unmet=("unmet_units", "mean"), total=("total_unmet_units", "mean"), capture=("capture_rate", "mean")).reset_index()
    acc = pd.read_csv(R / "access_by_scenario.csv")
    acc_sev = acc.groupby(["config", "severity"])[["share_cut_off", "pop_delayed", "pop_cut_off", "median_time_before_min", "median_time_after_min", "p90_time_after_min", "mean_time_after_min",
                                                    "facilities_out", "depot_reach_share"]].mean().reset_index()
    sens = pd.read_csv(R / "sensitivity.csv").groupby(["param", "value", "policy"]).unmet_units.mean().reset_index()
    rob = pd.read_csv(R / "robustness_missing_roads.csv").groupby("missing_share").agg(overlap=("top10_overlap", "mean"), delta=("delta_cut_off_vs_full", "mean"),
                                                                                         share_cut_off=("share_cut_off", "mean")).reset_index()
    vul = pd.read_csv(R / "village_vulnerability.csv")
    crit = pd.read_csv(R / "segment_criticality.csv")
    va = pd.read_csv(R / "profile_village_access.csv")
    cat = pd.read_csv(R / "profile_catchments.csv")
    paired = pd.read_csv(R / "paired_tests.csv")
    return {
        "profile": prof, "validation": val,
        "village_bands": _rows(pd.read_csv(R / "profile_village_bands.csv")), "road_categories": _rows(pd.read_csv(R / "profile_road_categories.csv")),
        "access_cdf": _rows(pd.read_csv(R / "profile_access_cdf.csv")),
        "catchments": _rows(cat, ["facility_id", "name", "residents_served", "stock_units", "demand_per_day", "days_of_cover"], 2),
        "snap_mvp": _rows(pd.read_csv(R / "profile_snap_audit.csv")), "snap_round1": ROUND1_SNAP,
        "scenario_summary": _rows(summ), "access_by_severity": _rows(acc_sev), "alloc_stats": _rows(stats),
        "alloc_means": _rows(decomp), "paired": _rows(paired), "hub_resilience": _rows(pd.read_csv(R / "hub_resilience.csv")),
        "sensitivity": _rows(sens), "sensitivity_speed": _rows(pd.read_csv(R / "sensitivity_speed.csv")),
        "sensitivity_snap": _rows(pd.read_csv(R / "sensitivity_snap.csv")), "robustness": _rows(rob),
        "village_baseline": {"id": va.hab_id.astype(int).tolist(), "time": [None if not np.isfinite(v) else round(float(v), 1) for v in va.time_before_min]},
        "vulnerability_top": _rows(vul.head(25), ["hab_id", "name", "population", "cut_off_freq", "cut_off_freq_mild", "cut_off_freq_moderate", "cut_off_freq_severe", "expected_residents_cut_off"]),
        "vulnerability_freq": {"id": vul.hab_id.astype(int).tolist(), "freq": [round(float(v), 3) for v in vul.cut_off_freq]},
        "criticality_top": _rows(crit.head(25), None, 2), "critical_seg_ids": crit.head(10).seg_id.astype(int).tolist(),
        "hubs_json": json.load(open(R / "hubs.json")),
    }


def main(out_dir=OUT):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    eng = Engine()
    for name, payload in (("geometry", geometry(eng)), ("scenarios", scenarios(eng)), ("evidence", evidence())):
        f = out / f"{name}.json"
        json.dump(payload, open(f, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
        print(f"wrote {f.relative_to(ROOT)}  {f.stat().st_size / 1024:.0f} KB")
