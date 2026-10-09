"""Build the Cachar inputs and the synthetic data used by the prototype.

Reads the raw downloads in datasets/raw/ (see datasets/README.md for how to fetch them), then writes:

  datasets/processed/cachar.gpkg          REAL data, cleaned: roads, habitations, human-health facilities
  datasets/synthetic/facilities_stock.csv SYNTHETIC: demand and stock per facility
  datasets/synthetic/depot.csv            SYNTHETIC: district medicine store
  datasets/synthetic/fleet.csv            SYNTHETIC: delivery vehicles
  datasets/synthetic/flood_scenarios.csv  SYNTHETIC: which road segments / facilities each flood scenario knocks out
  datasets/synthetic/scenario_summary.csv one row per scenario

Every parameter below is documented, with its justification, in datasets/synthetic/ASSUMPTIONS.md.
Run:  python datasets/build_datasets.py
"""
import json
import math
import re
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from PIL import Image
from scipy.spatial import cKDTree
from shapely.geometry import LineString, Point

# --------------------------------------------------------------------------- parameters
SEED = 42
CACHAR_DISTRICT_ID = 97          # DISTRICT_I of Cachar in the PMGSY layers (found via Silchar location)
UTM = "EPSG:32646"               # metric CRS covering Cachar
DEPOT_LONLAT = (92.7789, 24.8333)  # Silchar town centre; a SYNTHETIC depot location, not a real warehouse

# road speed by PMGSY road category (km/h) - assumption, no measured speeds available
SPEED_KMPH = {"NH": 50, "SH": 40, "MDR": 30, "RR(ODR)": 25, "RR(VR)": 20, "BR": 20, "RR(TRACK)": 10}
DEFAULT_SPEED = 20

# demand and stock - assumptions
DEMAND_COURSES_PER_PERSON_PER_DAY = 0.002   # "treatment courses" per person per day (abstract unit)
DAYS_OF_COVER_MEDIAN, DAYS_OF_COVER_SIGMA = 14, 0.5  # facility stock = demand * lognormal days of cover
DAYS_OF_COVER_CLIP = (2, 60)
DEPOT_DAYS_OF_COVER = 10                    # depot holds this many days of district-wide demand
N_TRUCKS, TRUCK_CAPACITY = 8, 3000          # units
N_BOATS, BOAT_CAPACITY = 2, 800             # stretch goal only (road-only model ignores them)

# synthetic flood scenarios: (flood height above nearest river in m, max distance from river in m)
SEVERITIES = {"mild": (1.0, 150.0), "moderate": (2.5, 600.0), "severe": (4.5, 1500.0)}  # tuned so ~10% / ~25% / ~40% of road length is cut
REPLICATES = 20                              # scenarios per severity
PARAM_JITTER_SIGMA = 0.25                    # lognormal jitter on height and distance per scenario
FACILITY_OUTAGE_PROB_IF_FLOODED = 0.5        # a flooded facility is out of service with this probability

TILE_Z, TILE_X0, TILE_Y0 = 10, 774, 438      # terrain tiles 774-777 x 438-440 at zoom 10
VET_PATTERN = re.compile(r"vet|veter|\bVAC\b|animal|livestock|poultry", re.I)

ROOT = Path(__file__).resolve().parent
RAW, PROC, SYN = ROOT / "raw", ROOT / "processed", ROOT / "synthetic"


# --------------------------------------------------------------------------- real data
def load_real():
    d = CACHAR_DISTRICT_ID
    hab = gpd.read_file(RAW / "pmgsy_habitation/Habitation.shp").query("DISTRICT_I == @d").to_crs(UTM)
    fac = gpd.read_file(RAW / "pmgsy_facilities/Facilities.shp").query("DISTRICT_I == @d").to_crs(UTM)
    rd = gpd.read_file(RAW / "pmgsy_roads/Road_DRRP.shp").query("DISTRICT_I == @d").to_crs(UTM)

    med = fac[fac.FAC_CATEGO == "Medical"].copy()
    is_vet = med.FAC_DESC.fillna("").str.contains(VET_PATTERN)
    print(f"medical facilities: {len(med)} | excluded veterinary: {int(is_vet.sum())} | kept (human health): {int((~is_vet).sum())}")
    med = med[~is_vet].rename(columns={"FACILITY_I": "facility_id", "FAC_DESC": "name"})
    med = med[["facility_id", "name", "geometry"]].reset_index(drop=True)

    rd = rd.reset_index(drop=True)
    rd["seg_id"] = rd.index
    rd["length_m"] = rd.length
    rd["speed_kmph"] = rd.RoadCatego.map(SPEED_KMPH).fillna(DEFAULT_SPEED)
    rd = rd[["seg_id", "DRRP_ROAD_", "RoadCatego", "RoadName", "RoadOwner", "length_m", "speed_kmph", "geometry"]]
    hab = hab.rename(columns={"HAB_ID": "hab_id", "HAB_NAME": "name", "TOT_POPULA": "population"})
    hab = hab[["hab_id", "name", "population", "geometry"]].reset_index(drop=True)
    return hab, med, rd


# --------------------------------------------------------------------------- terrain + rivers
def load_elevation():
    """Mosaic of AWS Terrarium tiles -> function (lon, lat arrays) -> elevation in metres."""
    xs, ys = range(TILE_X0, TILE_X0 + 4), range(TILE_Y0, TILE_Y0 + 3)
    mosaic = np.zeros((len(ys) * 256, len(xs) * 256), dtype=np.float64)
    for i, y in enumerate(ys):
        for j, x in enumerate(xs):
            rgb = np.asarray(Image.open(RAW / f"terrain_tiles/z{TILE_Z}_{x}_{y}.png").convert("RGB"), dtype=np.float64)
            mosaic[i * 256:(i + 1) * 256, j * 256:(j + 1) * 256] = rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768
    n = 2 ** TILE_Z * 256

    def sample(lon, lat):
        lon, lat = np.asarray(lon), np.asarray(lat)
        px = (lon + 180) / 360 * n - TILE_X0 * 256
        py = (1 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2 * n - TILE_Y0 * 256
        px = np.clip(px.astype(int), 0, mosaic.shape[1] - 1)
        py = np.clip(py.astype(int), 0, mosaic.shape[0] - 1)
        return mosaic[py, px]

    return sample


def load_river_points(step_m=250):
    """Sample points every ~250 m along rivers, canals and named streams (OSM waterways)."""
    data = json.load(open(RAW / "osm_waterways/waterways_cachar_bbox.json", encoding="utf-8"))
    keep, kinds = [], {}
    for e in data["elements"]:
        tags = e.get("tags", {})
        kind = tags.get("waterway")
        if kind in ("river", "canal") or (kind == "stream" and tags.get("name")):
            keep.append(LineString([(p["lon"], p["lat"]) for p in e["geometry"]]))
            kinds[kind] = kinds.get(kind, 0) + 1
    print("waterways used:", kinds)
    g = gpd.GeoSeries(keep, crs="EPSG:4326").to_crs(UTM)
    pts = []
    for line in g:
        for dist in np.arange(0, line.length + step_m, step_m):
            p = line.interpolate(min(dist, line.length))
            pts.append((p.x, p.y))
    return np.array(pts)


def flood_features(points_xy_utm, river_xy, elev, to_lonlat):
    """distance to nearest river sample (m) and height above that river point (m)."""
    tree = cKDTree(river_xy)
    d, idx = tree.query(points_xy_utm)
    pl = to_lonlat(points_xy_utm)
    rl = to_lonlat(river_xy[idx])
    h = np.maximum(elev(pl[:, 0], pl[:, 1]) - elev(rl[:, 0], rl[:, 1]), 0)
    return d, h


# --------------------------------------------------------------------------- main
def main():
    rng_master = np.random.SeedSequence(SEED)
    PROC.mkdir(exist_ok=True), SYN.mkdir(exist_ok=True)
    hab, med, rd = load_real()

    # ---- processed (real) layers
    out = PROC / "cachar.gpkg"
    if out.exists():
        out.unlink()
    rd.to_file(out, layer="roads", driver="GPKG")
    hab.to_file(out, layer="habitations", driver="GPKG")
    med.to_file(out, layer="health_facilities", driver="GPKG")
    print(f"wrote {out.name}: roads={len(rd)} habitations={len(hab)} health_facilities={len(med)}")

    # ---- catchments: each habitation is served by its nearest facility
    hxy = np.c_[hab.geometry.x, hab.geometry.y]
    fxy = np.c_[med.geometry.x, med.geometry.y]
    _, nearest = cKDTree(fxy).query(hxy)
    hab["facility_id"] = med.facility_id.values[nearest]
    catch = hab.groupby("facility_id").population.sum()

    # ---- synthetic stock
    rng = np.random.default_rng(rng_master.spawn(1)[0])
    fs = med.drop(columns="geometry").copy()
    fs["lon"], fs["lat"] = gpd.GeoSeries(med.geometry, crs=UTM).to_crs(4326).x, gpd.GeoSeries(med.geometry, crs=UTM).to_crs(4326).y
    fs["catchment_pop"] = fs.facility_id.map(catch).fillna(0).astype(int)
    fs["demand_per_day"] = fs.catchment_pop * DEMAND_COURSES_PER_PERSON_PER_DAY
    cover = np.clip(rng.lognormal(math.log(DAYS_OF_COVER_MEDIAN), DAYS_OF_COVER_SIGMA, len(fs)), *DAYS_OF_COVER_CLIP)
    fs["days_of_cover"] = cover.round(1)
    fs["stock_units"] = (fs.demand_per_day * cover).round().astype(int)
    fs["data_origin"] = "synthetic_stock;real_location_and_catchment_population"
    fs.to_csv(SYN / "facilities_stock.csv", index=False)

    total_demand = fs.demand_per_day.sum()
    pd.DataFrame([{"depot_id": "D1", "lon": DEPOT_LONLAT[0], "lat": DEPOT_LONLAT[1],
                   "stock_units": int(total_demand * DEPOT_DAYS_OF_COVER),
                   "data_origin": "synthetic (Silchar centre, not a real warehouse)"}]).to_csv(SYN / "depot.csv", index=False)
    fleet = [{"vehicle_id": f"T{i + 1}", "type": "truck", "capacity_units": TRUCK_CAPACITY, "used_in_road_model": True} for i in range(N_TRUCKS)]
    fleet += [{"vehicle_id": f"B{i + 1}", "type": "boat", "capacity_units": BOAT_CAPACITY, "used_in_road_model": False} for i in range(N_BOATS)]
    pd.DataFrame(fleet).to_csv(SYN / "fleet.csv", index=False)
    print(f"synthetic stock: {len(fs)} facilities | total demand/day={total_demand:.0f} | depot stock={int(total_demand * DEPOT_DAYS_OF_COVER)}")

    # ---- synthetic flood scenarios (rivers + terrain from real open data; the flood itself is simulated)
    elev = load_elevation()
    river_xy = load_river_points()
    to_lonlat = lambda xy: np.c_[gpd.GeoSeries([Point(*p) for p in xy], crs=UTM).to_crs(4326).apply(lambda g: (g.x, g.y)).tolist()]
    seg_mid = np.array([[g.interpolate(0.5, normalized=True).x, g.interpolate(0.5, normalized=True).y] for g in rd.geometry])
    d_seg, h_seg = flood_features(seg_mid, river_xy, elev, to_lonlat)
    d_fac, h_fac = flood_features(fxy, river_xy, elev, to_lonlat)
    print(f"distance to river (m): road segments median {np.median(d_seg):.0f}, facilities median {np.median(d_fac):.0f}")

    rows, summary = [], []
    scen_rngs = rng_master.spawn(len(SEVERITIES) * REPLICATES + 1)[1:]
    k = 0
    for sev, (h0, d0) in SEVERITIES.items():
        for rep in range(REPLICATES):
            r = np.random.default_rng(scen_rngs[k]); k += 1
            hl = h0 * math.exp(r.normal(0, PARAM_JITTER_SIGMA))
            dl = d0 * math.exp(r.normal(0, PARAM_JITTER_SIGMA))
            sid = f"{sev}_{rep:02d}"
            seg_cut = (h_seg < hl) & (d_seg < dl)
            fac_flooded = (h_fac < hl) & (d_fac < dl)
            fac_out = fac_flooded & (r.random(len(med)) < FACILITY_OUTAGE_PROB_IF_FLOODED)
            rows += [{"scenario": sid, "kind": "road_segment", "id": int(s)} for s in rd.seg_id[seg_cut]]
            rows += [{"scenario": sid, "kind": "facility", "id": int(f)} for f in med.facility_id[fac_out]]
            summary.append({"scenario": sid, "severity": sev, "flood_height_m": round(hl, 2), "flood_distance_m": round(dl),
                            "segments_cut": int(seg_cut.sum()), "share_road_length_cut": round(float(rd.length[seg_cut].sum() / rd.length.sum()), 4),
                            "facilities_out": int(fac_out.sum())})
    pd.DataFrame(rows).to_csv(SYN / "flood_scenarios.csv", index=False)
    summ = pd.DataFrame(summary)
    summ.to_csv(SYN / "scenario_summary.csv", index=False)
    print(summ.groupby("severity")[["segments_cut", "share_road_length_cut", "facilities_out"]].mean().round(3).to_string())


if __name__ == "__main__":
    main()
