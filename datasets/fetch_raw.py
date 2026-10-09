"""Download the raw open datasets into datasets/raw/ (not committed to git).

Usage:  python datasets/fetch_raw.py [--dest DIR] [--only pmgsy,worldpop,waterways,terrain]

Sources and licences are listed in datasets/README.md.
"""
import argparse
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

UA = {"User-Agent": "kernel-panic-hackathon-datafetch/0.1", "Accept": "*/*"}
PMGSY = "https://raw.githubusercontent.com/datameet/pmgsy-geosadak/master/data"
WORLDPOP = "https://data.worldpop.org/GIS/Population/Global_2000_2020_1km_UNadj/2020/IND/ind_ppp_2020_1km_Aggregated_UNadj.tif"
TERRAIN = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10/{x}/{y}.png"
OVERPASS = "https://overpass-api.de/api/interpreter"
WATERWAY_QUERY = '[out:json][timeout:120];way["waterway"~"^(river|stream|canal)$"](24.3,92.35,25.15,93.25);out geom;'


def get(url, dest, data=None, timeout=300):
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, data=data, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r, open(dest, "wb") as f:
        f.write(r.read())
    print(f"  {dest.name}: {dest.stat().st_size / 1e6:.1f} MB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dest", default=str(Path(__file__).resolve().parent / "raw"))
    ap.add_argument("--only", default="pmgsy,worldpop,waterways,terrain")
    a = ap.parse_args()
    raw, only = Path(a.dest), set(a.only.split(","))

    if "pmgsy" in only:
        print("PMGSY GeoSadak (Assam) via datameet mirror")
        for folder, zipname, out in [("Road_DRRP", "Assam.zip", "pmgsy_roads"), ("Habitation", "Assam.zip", "pmgsy_habitation"),
                                     ("Facilities", "Assam.zip", "pmgsy_facilities")]:
            z = raw / out / f"Assam_{folder}.zip"
            get(f"{PMGSY}/{folder}/{zipname}", z)
            with zipfile.ZipFile(z) as zf:
                for name in zf.namelist():  # refuse anything that is not a plain file name
                    if "/" in name or "\\" in name or name.startswith("."):
                        raise SystemExit(f"unexpected path in zip: {name}")
                zf.extractall(raw / out)
    if "worldpop" in only:
        print("WorldPop India 2020 1 km")
        get(WORLDPOP, raw / "worldpop" / "ind_ppp_2020_1km_Aggregated_UNadj.tif")
    if "waterways" in only:
        print("OSM waterways, Cachar bounding box (Overpass)")
        for attempt in range(4):
            try:
                get(OVERPASS, raw / "osm_waterways" / "waterways_cachar_bbox.json",
                    data=urllib.parse.urlencode({"data": WATERWAY_QUERY}).encode())
                break
            except Exception as e:  # Overpass is rate limited; retry
                print("  retry", attempt + 1, e)
                time.sleep(8)
    if "terrain" in only:
        print("AWS terrain tiles (zoom 10)")
        for x in range(774, 778):
            for y in range(438, 441):
                get(TERRAIN.format(x=x, y=y), raw / "terrain_tiles" / f"z10_{x}_{y}.png", timeout=60)


if __name__ == "__main__":
    main()
