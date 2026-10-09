import sys, geopandas as gpd, pandas as pd, numpy as np, networkx as nx, warnings
warnings.filterwarnings("ignore")
from shapely.ops import unary_union
from scipy.spatial import cKDTree
root = sys.argv[1]; D = 97
hab = gpd.read_file(f"{root}/pmgsy_habitation/Habitation.shp").query("DISTRICT_I==@D").to_crs(32646)
fac = gpd.read_file(f"{root}/pmgsy_facilities/Facilities.shp").query("DISTRICT_I==@D")
med = fac[fac.FAC_CATEGO=="Medical"].to_crs(32646)
rd  = gpd.read_file(f"{root}/pmgsy_roads/Road_DRRP.shp").query("DISTRICT_I==@D").to_crs(32646)
print("medical facilities in Cachar:", len(med), "| names sample:", med.FAC_DESC.head(12).tolist())
print("facility categories in Cachar:", fac.FAC_CATEGO.value_counts().to_dict())
print("road owners:", rd.RoadOwner.value_counts().to_dict())
lines = unary_union(list(rd.geometry)); segs = list(lines.geoms)
ends = np.array([[s.coords[0], s.coords[-1]] for s in segs])  # (n,2,2)
pts = ends.reshape(-1,2); tree = cKDTree(pts)
allroads = rd.unary_union
for tol in [1, 10, 25, 50, 100]:
    G = nx.Graph(); G.add_nodes_from(range(len(pts)))
    for i,j in tree.query_pairs(tol): G.add_edge(i,j)       # merge nearby endpoints
    for k in range(len(segs)): G.add_edge(2*k, 2*k+1)       # segment itself
    comps = sorted(nx.connected_components(G), key=len, reverse=True)
    big = comps[0]; big_idx = {n//2 for n in big}
    bigroad = unary_union([segs[k] for k in big_idx])
    hd = np.array([p.distance(bigroad) for p in hab.geometry])
    popshare = hab.TOT_POPULA[hd<=500].sum()/hab.TOT_POPULA.sum()
    md = np.array([p.distance(bigroad) for p in med.geometry]) if len(med) else np.array([])
    print(f"snap {tol:>3} m: components={len(comps):>4} | largest has {len(big_idx)/len(segs):.1%} of segments | pop within 500m of main network={popshare:.1%} | medical fac within 500m: {int((md<=500).sum())}/{len(md)}")
