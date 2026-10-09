"""HTTP API for the web calculator.   Run:  python -m floodready serve   (then open http://localhost:8000)

POST /api/simulate     one flood, one delivery set-up: access loss, the five methods, routes, truck schedule, Resilience Index
POST /api/ensemble     the same set-up on all 60 generated floods: means, bootstrap CIs, worst-10% average, paired tests
POST /api/pareto       unmet demand against fleet size, and where more trucks stop helping
POST /api/repair       which cut road segments would give the most residents their access back if restored
POST /api/uncertainty  how far the answer moves if a share of real roads is missing from our data
POST /api/flood/preview  size of a parametric or hand-drawn flood (no routing, fast)
GET  /api/meta         presets, defaults, assumptions, index formula
GET  /api/health

All floods, stock, the depot and the fleet are generated (datasets/synthetic/ASSUMPTIONS.md). The API serves the built web app from web/dist
when it exists.
"""
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from . import allocate, score
from .analytics import LABELS, Engine, Setup, _clean
from .impact import DELAY_MIN

WEB_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"
Policy = Literal["none", "proportional", "nearest_first", "nearest_first_post", "access_opt"]


class FloodIn(BaseModel):
    mode: Literal["preset", "manual", "parametric"] = "preset"
    preset: str = "severe_11"
    cut_segments: list[int] = Field(default_factory=list, max_length=1200)
    out_facilities: list[int] = Field(default_factory=list, max_length=200)
    height_m: float = Field(2.5, ge=0, le=15)
    distance_m: float = Field(600, ge=0, le=6000)
    seed: int = 42
    outage_prob: float = Field(0.5, ge=0, le=1)


class HubsIn(BaseModel):
    config: Literal["single", "three", "custom"] = "three"
    points: list[tuple[float, float]] = Field(default_factory=list, max_length=6)   # (lon, lat); snapped to the nearest road junction


class SetupIn(BaseModel):
    trucks: int = Field(4, ge=1, le=20)
    hubs: HubsIn = Field(default_factory=HubsIn)
    stock_mult: float = Field(1.0, ge=0.1, le=4)
    horizon: int = Field(14, ge=3, le=60)
    rate_mult: float = Field(1.0, ge=0.25, le=4)
    policy: Policy = "access_opt"
    speed: float = Field(1.0, ge=0.5, le=1.5)
    delay_min: float = Field(DELAY_MIN, ge=5, le=120)


class Req(BaseModel):
    flood: FloodIn = Field(default_factory=FloodIn)
    setup: SetupIn = Field(default_factory=SetupIn)
    weights: Optional[dict[str, float]] = None


class UncertaintyReq(Req):
    missing_share: float = Field(0.2, ge=0.02, le=0.4)
    reps: int = Field(24, ge=4, le=60)


engine: Optional[Engine] = None


@asynccontextmanager
async def lifespan(app):
    global engine
    engine = Engine()
    yield


app = FastAPI(title="Flood-Ready Access", version="1.0", lifespan=lifespan,
              description="Flood-driven loss of road access to health facilities in Cachar, Assam, with stock allocation. Generated floods and stock: method results, not measurements.")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])


def _resolve(req: Req):
    f, s = req.flood, req.setup
    try:
        scenario = engine.resolve_scenario(f.mode, f.preset, f.cut_segments, f.out_facilities, f.height_m, f.distance_m, f.seed, f.outage_prob)
    except KeyError as e:
        raise HTTPException(404, str(e))
    hubs = engine.resolve_hubs(s.hubs.config, s.hubs.points)
    setup = Setup(trucks=s.trucks, hubs=hubs, stock_mult=s.stock_mult, horizon=s.horizon, rate_mult=s.rate_mult, policy=s.policy,
                  speed=round(s.speed, 2), delay_min=s.delay_min)
    return scenario, setup


@app.get("/api/health")
def health():
    return {"ok": engine is not None, "load_seconds": engine.load_seconds if engine else None}


@app.get("/api/meta")
def meta():
    d = engine.base
    return _clean({
        "presets": engine.presets(), "policies": [{"id": k, "label": v} for k, v in LABELS.items()],
        "hubs": {"single": engine.hub_points(engine.resolve_hubs("single")), "three": engine.hub_points(engine.three_hubs)},
        "defaults": {"trucks": 4, "stock_mult": 1.0, "horizon": allocate.HORIZON_DAYS, "rate": allocate.RATE, "delay_min": DELAY_MIN,
                     "policy": "access_opt", "hubs": "three", "preset": "severe_11"},
        "assumptions": {"rate_per_person_day": allocate.RATE, "horizon_days": allocate.HORIZON_DAYS, "delivery_days": allocate.DELIVERY_DAYS,
                        "truck_capacity_units": allocate.TRUCK_CAPACITY, "truck_hours_per_day": allocate.TRUCK_HOURS_PER_DAY,
                        "service_hours": allocate.SERVICE_HOURS, "depot_days_of_cover": 10,
                        "depot_stock_units": float(10 * d.fac.demand_per_day.sum())},
        "index": {"weights": score.DEFAULT_WEIGHTS, "labels": score.LABELS, "formula": score.FORMULA, "short_limit": score.SHORT_LIMIT},
        "counts": {"villages": len(d.hab), "facilities": len(d.fac), "road_segments": int(d.roads.seg_id.nunique()), "residents": int(d.hab.population.sum())}})


@app.post("/api/simulate")
def simulate(req: Req):
    scenario, setup = _resolve(req)
    return JSONResponse(engine.simulate(scenario, setup, req.weights))


@app.post("/api/ensemble")
def ensemble(req: Req):
    _, setup = _resolve(req)
    return JSONResponse(engine.ensemble(setup, req.weights))


@app.post("/api/pareto")
def pareto(req: Req):
    scenario, setup = _resolve(req)
    return JSONResponse(engine.pareto(scenario, setup))


@app.post("/api/repair")
def repair(req: Req):
    scenario, setup = _resolve(req)
    return JSONResponse(engine.repair(scenario, setup))


@app.post("/api/uncertainty")
def uncertainty(req: UncertaintyReq):
    scenario, setup = _resolve(req)
    return JSONResponse(engine.uncertainty(scenario, setup, req.weights, req.missing_share, req.reps))


@app.post("/api/flood/preview")
def preview(req: Req):
    scenario, _ = _resolve(req)
    return JSONResponse(engine.preview(scenario))


if WEB_DIST.exists():
    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        f = (WEB_DIST / path).resolve()
        if path and f.is_file() and WEB_DIST in f.parents:
            return FileResponse(f)
        return FileResponse(WEB_DIST / "index.html")
