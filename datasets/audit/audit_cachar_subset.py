import sys, geopandas as gpd, pandas as pd, numpy as np, networkx as nx, rasterio
from shapely.geometry import Point
from shapely.ops import unary_union
from rasterio.windows import from_bounds
root = sys.argv[1]
hab = gpd.read_file(f"{root}/pmgsy_habitation/Habitation.shp")
fac = gpd.read_file(f"{root}/pmgsy_facilities/Facilities.shp")
rd  = gpd.read_file(f"{root}/pmgsy_roads/Road_DRRP.shp")
print("facility categories:", fac.FAC_CATEGO.value_counts().to_dict())
health = fac[fac.FAC_CATEGO.str.contains("Health", case=False, na=False)]
print("health facilities (Assam):", len(health)); print("sample names:", health.FAC_DESC.head(12).tolist())
# Cachar = district of habitations nearest Silchar centre
sil = Point(92.7789, 24.8333)
near = hab.assign(d=hab.geometry.distance(sil)).nsmallest(200,'d')
dist_id = int(near.DISTRICT_I.mode()[0]); print("Cachar DISTRICT_I (by Silchar proximity):", dist_id, "| share of 200 nearest:", (near.DISTRICT_I==dist_id).mean())
H = hab[hab.DISTRICT_I==dist_id]; F = health[health.DISTRICT_I==dist_id]; R = rd[rd.DISTRICT_I==dist_id]
print(f"Cachar: habitations={len(H)} pop={int(H.TOT_POPULA.sum())} | health facilities={len(F)} | road segments={len(R)}")
print("pop stats:", H.TOT_POPULA.describe()[['min','50%','max']].to_dict(), "| zero-pop:", int((H.TOT_POPULA==0).sum()))
print("health names:", F.FAC_DESC.tolist()[:15])
print("road categories:", R.RoadCatego.value_counts().head(8).to_dict())
Rm = R.to_crs(32646); print("total road length km:", round(Rm.length.sum()/1000,1))
bounds = H.total_bounds; print("Cachar habitation bounds:", np.round(bounds,3))
# --- connectivity: node lines at intersections, then components
lines = unary_union(list(Rm.geometry))
segs = list(lines.geoms) if hasattr(lines,'geoms') else [lines]
G = nx.Graph()
for s in segs:
    c = list(s.coords); G.add_edge((round(c[0][0]),round(c[0][1])), (round(c[-1][0]),round(c[-1][1])), w=s.length)
comps = sorted(nx.connected_components(G), key=len, reverse=True)
print(f"road graph (noded): nodes={G.number_of_nodes()} edges={G.number_of_edges()} components={len(comps)} | largest comp holds {len(comps[0])/G.number_of_nodes():.1%} of nodes")
# --- habitation / facility distance to nearest road
Hm = H.to_crs(32646); Fm = F.to_crs(32646); allroads = Rm.unary_union
dh = pd.Series([p.distance(allroads) for p in Hm.geometry]); df = pd.Series([p.distance(allroads) for p in Fm.geometry], dtype=float)
print("habitation->road distance m: median %.0f | p90 %.0f | >500m: %.1f%%" % (dh.median(), dh.quantile(.9), (dh>500).mean()*100))
print("health fac->road: n=%d" % len(df) + ((" median %.0f max %.0f" % (df.median(), df.max())) if len(df) else " (none)"))
# --- WorldPop sanity
with rasterio.open(f"{root}/worldpop/ind_ppp_2020_1km_Aggregated_UNadj.tif") as src:
    print("worldpop crs", src.crs, "res", src.res)
    w = from_bounds(*bounds, src.transform); a = src.read(1, window=w, masked=True)
    print("worldpop sum in Cachar habitation bbox: %.0f (bbox includes neighbours; compare order of magnitude)" % float(a.sum()))
