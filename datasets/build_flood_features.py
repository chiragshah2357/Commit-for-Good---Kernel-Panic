"""Write the per-segment and per-facility flood features that the live "parametric flood" in the web app needs.

build_datasets.py computes, for every road segment and every facility, (a) the distance to the nearest river and (b) its height
above that river point, then uses them to generate the 60 flood scenarios. Those two numbers were not saved. This script
recomputes them with the same functions and writes them, so a flood of any height and reach can be generated without the
large raw downloads (rivers and terrain tiles) being present. It does not touch any existing output.

  datasets/synthetic/flood_features.csv   kind (road_segment | facility), id, dist_river_m, height_above_river_m   [derived from REAL rivers + terrain]

Needs datasets/raw/osm_waterways and datasets/raw/terrain_tiles (see datasets/README.md).
Run:  python datasets/build_flood_features.py
"""
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import Point

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_datasets as bd  # noqa: E402  (same terrain and river readers as the scenario generator)

GPKG = bd.PROC / "cachar.gpkg"


def main():
    roads = gpd.read_file(GPKG, layer="roads")
    fac = gpd.read_file(GPKG, layer="health_facilities")
    elev, river_xy = bd.load_elevation(), bd.load_river_points()
    to_lonlat = lambda xy: np.c_[gpd.GeoSeries([Point(*p) for p in xy], crs=bd.UTM).to_crs(4326).apply(lambda g: (g.x, g.y)).tolist()]
    mid = np.array([[g.interpolate(0.5, normalized=True).x, g.interpolate(0.5, normalized=True).y] for g in roads.geometry])
    d_seg, h_seg = bd.flood_features(mid, river_xy, elev, to_lonlat)
    d_fac, h_fac = bd.flood_features(np.c_[fac.geometry.x, fac.geometry.y], river_xy, elev, to_lonlat)
    out = pd.concat([
        pd.DataFrame({"kind": "road_segment", "id": roads.seg_id.astype(int), "dist_river_m": d_seg.round(1), "height_above_river_m": h_seg.round(2)}),
        pd.DataFrame({"kind": "facility", "id": fac.facility_id.astype(int), "dist_river_m": d_fac.round(1), "height_above_river_m": h_fac.round(2)}),
    ])
    path = bd.SYN / "flood_features.csv"
    out.to_csv(path, index=False)
    print(f"wrote {path.name}: {len(roads)} road segments, {len(fac)} facilities")


if __name__ == "__main__":
    main()
