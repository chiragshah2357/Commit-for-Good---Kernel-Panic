# Commit for Good — Team Kernel Panic

> Flood-Ready Access helps disaster-response planners evaluate road-network failures in Cachar, Assam, and route emergency medical supplies across the damaged network using an access-aware integer programme.

This repository is the open-source submission of Team Kernel Panic for COMMIT FOR GOOD. Generated scenarios and simulated results are labelled as such; they should not be interpreted as measured real-world outcomes.

## About the hackathon

COMMIT FOR GOOD is a three-day open-source hackathon on AI for public good. The challenge domain is **AI for Resilient and Sustainable Supply Chains**. Participants identify a specific real-world problem in the domain, show evidence that it matters, build an AI-powered open-source prototype, and release it.

## The problem

Disaster response planners and health officials cannot efficiently deploy limited emergency medical supplies and vehicles because they lack real-time visibility into which roads are cut and how catchment populations dynamically shift to surviving facilities. This can cause delivery waste, stockouts at newly overwhelmed facilities, and stranded populations left without care.

Disaster-response logistics can rely on pre-flood proportional allocation or a "blind" nearest-first approach. These methods do not account for the physical reality of the damaged network and may send trucks to facilities that are unreachable while reachable ones run dry. Press and abstract-level figures documenting this vulnerability during extreme weather events in Assam are secondary evidence; see our Brief for the full context.

## What this does

**Input:** A district road network with habitation populations and health facilities (real open data from Cachar), a flood scenario dictating cut road segments (generated), and a logistics budget of available trucks, hours, and depot stock (generated).

**Output:** An access-loss assessment detailing cut-off villages, a truck-level delivery schedule optimising for unmet demand using an access-aware integer programme, and a ranked list of the most critical road segments to repair first.

## Example

Running the following command simulates a severe flood scenario and allocates stock using a four-truck fleet:

```bash
python -m floodready demo --scenario severe_11 --trucks 4
```

Example output from the generated scenario:

```text
3. WHO LOSES ACCESS
   715,833 residents cut off (44.1%) in 556 villages | 723,682 delayed 30+ min | mean travel 11.6 -> 15.8 min

5. METHOD COMPARISON (unmet demand over 14 days, units)
   do nothing 7,846 | proportional 5,199 | nearest-first (blind) 6,455 | access-aware optimiser 5,103
```

These are simulated scenario outputs, not measurements from an actual flood.

## How it works

The engine builds a routable graph from road lines and simulates flood cuts using a parametric river-height rule. It runs a multi-source Dijkstra algorithm to assess access loss, then uses a SciPy HiGHS integer programme (a 0/1 multi-constraint knapsack) to allocate depot stock to reachable facilities, constrained by a strict truck-hour budget. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the complete system diagram (Mermaid) and detailed model breakdowns.

## Data

Real inputs are open data (PMGSY GeoSadak roads, habitations and facilities for Cachar, Assam; OpenStreetMap waterways; AWS terrain tiles). Stock levels, a depot, a vehicle fleet, and flood scenarios are **generated** and declared as such, with a fixed seed (42). Large raw downloads are not committed; `datasets/fetch_raw.py` fetches them. Sources, licences, and the audit are in [datasets/README.md](datasets/README.md) and [datasets/AUDIT.md](datasets/AUDIT.md); every synthetic parameter is in [datasets/synthetic/ASSUMPTIONS.md](datasets/synthetic/ASSUMPTIONS.md). Results on generated data demonstrate a method, not a measured real-world outcome.

## Installation

```bash
git clone https://github.com/chiragshah2357/Commit-for-Good---Kernel-Panic.git
cd Commit-for-Good---Kernel-Panic
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

The cleaned Cachar data (`datasets/processed/`) and generated scenarios (`datasets/synthetic/`) are committed, so the commands below work without downloading anything. To rebuild from the raw sources, run `python datasets/fetch_raw.py` and then `python datasets/build_datasets.py`.

## Usage

```bash
python -m floodready profile       # Data profile: inputs, data quality, and access before a flood
python -m floodready evaluate      # 60 floods x 5 methods x 3 depot setups x 3 fleet sizes; statistics, sensitivity, and robustness (~3 min)
python -m floodready report         # Figures in results/figures/ and results/METRICS.md
python -m floodready demo --scenario severe_11 --trucks 4 --map results/demo_map.png  # One-scenario walkthrough
python -m floodready serve          # Web calculator API at http://localhost:8000 (see Web app below)
pytest                             # 44 tests
```

Example (abridged output of the demo command):

```text
3. WHO LOSES ACCESS
   715,833 residents cut off (44.1%) in 556 villages | 723,682 delayed 30+ min | mean travel 11.6 -> 15.8 min

5. METHOD COMPARISON (unmet demand over 14 days, units)
   do nothing 7,846 | proportional 5,199 | nearest-first (blind) 6,455 | access-aware optimiser 5,103
```

## Web app

A React + TypeScript interface over the same engine is in [web/](web/):

- **Brief (landing page):** A scroll-driven map of Cachar in which a simulated flood cuts the roads and villages lose access.
- **Evidence:** The Round 1 brief in full (tables, sources, AI declaration), with interactive figures, the data profile, the method and formulas, and results with confidence intervals, paired tests, and robustness checks.
- **Calculator:** Pick any of the 60 generated floods, draw your own by clicking roads, raise a river, or upload segment IDs; place hubs; set the fleet and method. It reports who loses access, compares the five methods (and replays the setup on all 60 floods), plans deliveries and truck schedules, ranks roads to repair, shows where more trucks stop helping, and gives a 0–100 Resilience Index whose formula and weights are shown on screen. Every figure is stamped real, generated, or computed.
- **Presenter mode (`Shift+P`):** Steps through the five-minute talk track in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md); press `N` to show notes.

```bash
python -m floodready serve          # API, and the built app once it exists, at http://localhost:8000
cd web && npm install && npm run build  # Build once (Node 20+), then reload http://localhost:8000
cd web && npm run dev               # Develop with hot reload at http://localhost:5173 (proxies /api to :8000)
python -m floodready export         # Rewrite web/public/data/*.json from results/ (rivers need the raw downloads)
```

The Evidence and Brief pages read static JSON and work without the API; the Calculator needs `python -m floodready serve`. Interactive API docs are at `/docs`.

## Evaluation

Each of 60 generated floods (20 each of mild, moderate, and severe) is assessed for loss of access; stock is then allocated by five methods under three depot setups and three fleet sizes. Metrics include residents cut off and delayed, travel time, unmet demand, share of avoidable unmet demand captured, delivery waste, equity of unmet demand, and truck-hours. Statistics include bootstrap confidence intervals, paired tests, hub choice validated on held-out floods, sensitivity sweeps, robustness to missing roads, and validation checks. Full tables: [results/METRICS.md](results/METRICS.md).

On the generated evaluation set, the reported headline findings are:

- Using post-flood information (who each facility now serves and what is reachable) removes most avoidable unmet demand; an optimiser adds value only when trucks are scarce.
- A single depot is isolated in two thirds of held-out floods; three pre-positioned hubs reduce that to 10% (72% of facilities reachable against 45%).
- What remains unmet is mostly unreachable by road, which points to pre-positioning stock at facilities and to non-road access.

## Limitations

Stock, demand, depot, fleet, and flood extents are **generated** (seed 42), so results show how the method behaves under stated assumptions and are not findings about a real flood. Road data is a July 2022 snapshot; travel speeds are assumed; health facilities are identified by name only; 11 facilities serve no village on a travel-time basis. See [datasets/synthetic/ASSUMPTIONS.md](datasets/synthetic/ASSUMPTIONS.md) and [datasets/AUDIT.md](datasets/AUDIT.md).

## Project layout

```text
floodready/   network.py (road graph), impact.py (access loss), allocate.py (methods), evaluate.py, profile.py, report.py, demo.py
              analytics.py (what-if engine), api.py (FastAPI), floodgen.py (parametric floods), score.py (Resilience Index), export.py
web/          React + TypeScript app: src/pages (Landing, Evidence, calculator), src/components, public/data (static JSON)
datasets/     raw (ignored), processed (real, cleaned), synthetic (generated), audit, build and fetch scripts
results/      CSV outputs, METRICS.md, figures/
tests/        44 tests
docs/         DEMO_SCRIPT.md, ARCHITECTURE.md
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the branching convention, and how to propose a change. Good places to start are issues labelled `good first issue`.

## Team

Team Kernel Panic: Chirag ([@chiragshah2357](https://github.com/chiragshah2357)) and Augustya ([@AugustyaSingh](https://github.com/AugustyaSingh)).

## Licence

MIT. See [LICENSE](LICENSE). Third-party data, code, and models keep their own licences; see [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md).
