"""Build a routable road graph from the cleaned PMGSY road lines.

The published road lines are not topologically joined (see datasets/AUDIT.md). We therefore
  1. split every line wherever it crosses another line or where another line's endpoint lies within SNAP_M of it,
  2. merge all piece endpoints that lie within SNAP_M of each other into one node,
  3. keep, for every edge, the id of the original road segment it came from, so that flood scenarios
     (which cut whole original segments) can be applied by id.
"""
from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
from pyproj import Transformer
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree
from shapely.geometry import Point
from shapely.ops import substring

SNAP_M = 10.0            # endpoint snapping tolerance in metres (chosen in datasets/AUDIT.md)
MIN_PIECE_M = 0.5        # pieces shorter than this are dropped
ACCESS_SPEED_KMPH = 10.0 # assumed speed of the first/last leg between a village or facility and its nearest node
DEPOT_LONLAT = (92.7789, 24.8333)  # synthetic depot at Silchar centre (datasets/synthetic/depot.csv)
UTM = "EPSG:32646"
DATA = Path(__file__).resolve().parent.parent / "datasets"


@dataclass
class RoadGraph:
    node_xy: np.ndarray       # (n, 2) metres
    u: np.ndarray             # edge start node
    v: np.ndarray             # edge end node
    length_m: np.ndarray
    minutes: np.ndarray       # travel time along the edge
    seg_id: np.ndarray        # id of the original road segment

    @property
    def n_nodes(self):
        return len(self.node_xy)

    def matrix(self, cut_segments=(), weight="minutes"):
        """Symmetric sparse matrix (travel minutes, or metres if weight="length_m") with the given original segments removed."""
        w = self.minutes if weight == "minutes" else self.length_m
        alive = ~np.isin(self.seg_id, list(cut_segments)) if len(cut_segments) else np.ones(len(self.u), bool)
        df = pd.DataFrame({"u": self.u[alive], "v": self.v[alive], "w": w[alive]})
        df = df.assign(a=df[["u", "v"]].min(axis=1), b=df[["u", "v"]].max(axis=1)).groupby(["a", "b"], as_index=False).w.min()
        return csr_matrix((df.w, (df.a, df.b)), shape=(self.n_nodes, self.n_nodes))

    def components(self):
        n, labels = connected_components(self.matrix(), directed=False)
        return n, labels


def _split_distances(lines, snap):
    """For every line, the distances along it at which it must be split."""
    tree = shapely.STRtree(lines)
    cuts = [{0.0, float(l.length)} for l in lines]
    ii, jj = tree.query(lines, predicate="dwithin", distance=snap)
    for i, j in zip(ii, jj):
        if i == j:
            continue
        li, lj = lines[i], lines[j]
        inter = li.intersection(lj)
        pts = []
        if not inter.is_empty:
            for g in getattr(inter, "geoms", [inter]):
                pts += list(g.coords) if g.geom_type == "LineString" else [(g.x, g.y)]
        for p in pts:
            cuts[i].add(float(li.project(Point(p))))
            cuts[j].add(float(lj.project(Point(p))))
        for end in (Point(li.coords[0]), Point(li.coords[-1])):  # T-junctions: our endpoint close to the other line
            if lj.distance(end) <= snap:
                cuts[j].add(float(lj.project(end)))
    return cuts


def build_road_graph(roads: gpd.GeoDataFrame, snap_m: float = SNAP_M) -> RoadGraph:
    """roads: LineString geometries in a metric CRS with columns seg_id and speed_kmph."""
    lines = list(roads.geometry.values)
    cuts = _split_distances(lines, snap_m)
    pieces = []  # (seg_id, start xy, end xy, length, speed)
    for line, c, sid, spd in zip(lines, cuts, roads.seg_id.values, roads.speed_kmph.values):
        d = sorted(c)
        keep = [d[0]]
        for x in d[1:]:
            if x - keep[-1] >= MIN_PIECE_M:
                keep.append(x)
        if keep[-1] != d[-1]:
            keep[-1] = d[-1]
        for a, b in zip(keep[:-1], keep[1:]):
            p = substring(line, a, b)
            if p.length >= MIN_PIECE_M:
                pieces.append((sid, p.coords[0], p.coords[-1], p.length, spd))
    ends = np.array([[p[1], p[2]] for p in pieces]).reshape(-1, 2)  # 2 per piece
    tree = cKDTree(ends)
    pairs = tree.query_pairs(snap_m + 0.5, output_type="ndarray")
    adj = csr_matrix((np.ones(len(pairs)), (pairs[:, 0], pairs[:, 1])), shape=(len(ends), len(ends)))
    _, label = connected_components(adj, directed=False)
    n_nodes = label.max() + 1
    node_xy = np.zeros((n_nodes, 2))
    np.add.at(node_xy, label, ends)
    node_xy /= np.bincount(label, minlength=n_nodes)[:, None]
    u, v = label[0::2], label[1::2]
    keep = u != v
    length = np.array([p[3] for p in pieces])
    speed = np.array([p[4] for p in pieces], dtype=float)
    return RoadGraph(node_xy=node_xy, u=u[keep], v=v[keep], length_m=length[keep],
                     minutes=(length / 1000.0 / speed * 60.0)[keep], seg_id=np.array([p[0] for p in pieces])[keep])


@dataclass
class District:
    """Road graph plus villages, facilities and the depot attached to graph nodes."""
    graph: RoadGraph
    hab: pd.DataFrame          # hab_id, name, population, node, access_min
    fac: pd.DataFrame          # facility_id, name, stock_units, node, access_min
    depot_node: int
    roads: gpd.GeoDataFrame


def _attach(points_xy, node_xy, node_ids=None):
    ids = np.arange(len(node_xy)) if node_ids is None else node_ids
    d, k = cKDTree(node_xy[ids]).query(points_xy)
    return ids[k], d / 1000.0 / ACCESS_SPEED_KMPH * 60.0


def load_cachar(data_dir=DATA, snap_m: float = SNAP_M) -> District:
    gp = Path(data_dir) / "processed" / "cachar.gpkg"
    roads = gpd.read_file(gp, layer="roads")
    hab = gpd.read_file(gp, layer="habitations")
    fac = gpd.read_file(gp, layer="health_facilities")
    stock = pd.read_csv(Path(data_dir) / "synthetic" / "facilities_stock.csv")[["facility_id", "stock_units", "demand_per_day"]]
    graph = build_road_graph(roads, snap_m)
    n_comp, labels = graph.components()
    main = np.flatnonzero(labels == np.bincount(labels).argmax())  # nodes of the largest component
    hnode, hacc = _attach(np.c_[hab.geometry.x, hab.geometry.y], graph.node_xy)
    fnode, facc = _attach(np.c_[fac.geometry.x, fac.geometry.y], graph.node_xy)
    dx, dy = Transformer.from_crs("EPSG:4326", UTM, always_xy=True).transform(*DEPOT_LONLAT)
    dnode, _ = _attach(np.array([[dx, dy]]), graph.node_xy, main)
    hab_df = pd.DataFrame({"hab_id": hab.hab_id.values, "name": hab.name.values, "population": hab.population.values,
                           "node": hnode, "access_min": hacc, "x": hab.geometry.x.values, "y": hab.geometry.y.values})
    fac_df = pd.DataFrame({"facility_id": fac.facility_id.values, "name": fac.name.values, "node": fnode, "access_min": facc,
                           "x": fac.geometry.x.values, "y": fac.geometry.y.values}).merge(stock, on="facility_id", how="left")
    return District(graph=graph, hab=hab_df, fac=fac_df, depot_node=int(dnode[0]), roads=roads)
