# Commit for Good - Team Kernel Panic

> **Status: work in progress.** This repository is the open-source submission of Team Kernel Panic for
> [COMMIT FOR GOOD](#about-the-hackathon) (9-11 October 2026). Sections marked **TBD** are filled in as the
> project develops; nothing below is a result until it says so.

*One sentence on what this does and for whom: TBD.*

## About the hackathon

COMMIT FOR GOOD is a three-day open-source hackathon on AI for public good. The challenge domain is
**AI for Resilient and Sustainable Supply Chains**. Participants are not given a problem: they find one specific,
real-world problem in the domain, show with evidence that it matters, build an AI-powered open-source prototype,
and release it.

## The problem

**TBD.** Written as: *[Who] cannot [do what] because [why], which causes [consequence].* Followed by the sourced
evidence that it matters, and what already exists and where it falls short.

## What this does

**Input:** TBD (a specific thing, with a real example)

**Output:** TBD (a specific thing, with a real example)

## Example

TBD - real input and real output, shown as text, once the proof of concept runs.

## How it works

TBD - the approach, why this method, and a diagram.

## Data

Real inputs are open data (PMGSY GeoSadak roads, habitations and facilities for Cachar, Assam; OpenStreetMap
waterways; AWS terrain tiles). Stock levels, a depot, a vehicle fleet and flood scenarios are **generated** and
declared as such, with a fixed seed (42). Large raw downloads are not committed; `datasets/fetch_raw.py` fetches
them. Sources, licences and the audit are in [datasets/README.md](datasets/README.md) and
[datasets/AUDIT.md](datasets/AUDIT.md); every synthetic parameter is in
[datasets/synthetic/ASSUMPTIONS.md](datasets/synthetic/ASSUMPTIONS.md). Results on generated data demonstrate a
method, not a measured real-world outcome.

## Installation

```bash
git clone https://github.com/chiragshah2357/Commit-for-Good---Kernel-Panic.git
cd Commit-for-Good---Kernel-Panic
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

The cleaned Cachar data (`datasets/processed/`) and the generated scenarios (`datasets/synthetic/`) are committed, so the
commands below work without downloading anything. To rebuild from the raw sources: `python datasets/fetch_raw.py` then
`python datasets/build_datasets.py`.

## Usage

```bash
python -m floodready profile     # data profile (landing page): what was ingested, how clean it is, access before any flood
python -m floodready evaluate    # 60 floods x 5 methods x 3 depot setups x 3 fleet sizes, statistics, sensitivity, robustness (~3 min)
python -m floodready report      # figures (results/figures/) and results/METRICS.md
python -m floodready demo --scenario severe_11 --trucks 4 --map results/demo_map.png   # one-scenario walkthrough
python -m floodready serve       # web calculator API on http://localhost:8000 (see Web app below)
pytest                           # 44 tests
```

Example (abridged output of the demo command):

```
 3. WHO LOSES ACCESS
    715,833 residents cut off (44.1%) in 556 villages | 723,682 delayed 30+ min | mean travel 11.6 -> 15.8 min
 5. METHOD COMPARISON (unmet demand over 14 days, units)
    do nothing 7,846 | proportional 5,199 | nearest-first (blind) 6,455 | access-aware optimiser 5,103
```

## Web app

A React + TypeScript interface over the same engine, in [web/](web/):

- **Brief** (landing): a scroll-driven map of Cachar in which a simulated flood cuts the roads and villages lose access.
- **Evidence**: the Round 1 brief in full (tables, sources, AI declaration) with interactive figures, the data profile, the
  method and formulas, and the results with confidence intervals, paired tests and robustness checks.
- **Calculator**: pick any of the 60 generated floods, draw your own by clicking roads, raise a river, or upload segment ids;
  place hubs, set the fleet and the method. It reports who loses access, compares the five methods (and replays the set-up on
  all 60 floods), plans deliveries and truck schedules, ranks roads to repair, shows where more trucks stop helping, and gives a
  0-100 Resilience Index whose formula and weights are on screen. Every figure is stamped real, generated or computed.
- **Presenter mode** (`Shift+P`): steps through the 5-minute talk track in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md); `N` shows notes.

```bash
python -m floodready serve                     # API, and the built app once it exists: http://localhost:8000
cd web && npm install && npm run build         # build once (Node 20+), then reload http://localhost:8000
cd web && npm run dev                          # or develop with hot reload on http://localhost:5173 (proxies /api to :8000)
python -m floodready export                    # rewrite web/public/data/*.json from results/ (rivers need the raw downloads)
```

The Evidence and Brief pages read static JSON and work without the API; the Calculator needs `python -m floodready serve`.
Interactive API docs are at `/docs`.

## Evaluation

Each of 60 generated floods (20 each of mild, moderate and severe) is assessed for loss of access, then stock is allocated by five
methods under three depot setups and three fleet sizes. Metrics: residents cut off and delayed, travel time, unmet demand, share of
avoidable unmet demand captured, delivery waste, equity of unmet demand, truck-hours. Statistics: bootstrap confidence intervals,
paired tests, hub choice validated on held-out floods, sensitivity sweeps, robustness to missing roads, validation checks.
Full tables: [results/METRICS.md](results/METRICS.md). Headline findings:

- Using post-flood information (who each facility now serves, what is reachable) removes most avoidable unmet demand; an optimiser adds
  value only when trucks are scarce.
- A single depot is isolated in two thirds of held-out floods; three pre-positioned hubs cut that to 10% (72% of facilities reachable
  against 45%).
- What remains unmet is mostly unreachable by road, which points to pre-positioning stock at facilities and to non-road access.

## Limitations

Stock, demand, depot, fleet and flood extents are **generated** (seed 42), so results show how the method behaves under stated
assumptions and are not findings about a real flood. Road data is a July 2022 snapshot; travel speeds are assumed; human-health
facilities are identified by name only; 11 facilities serve no village on a travel-time basis. See
[datasets/synthetic/ASSUMPTIONS.md](datasets/synthetic/ASSUMPTIONS.md) and [datasets/AUDIT.md](datasets/AUDIT.md).

## Project layout

```
floodready/   network.py (road graph) impact.py (access loss) allocate.py (methods) evaluate.py profile.py report.py demo.py
              analytics.py (what-if engine) api.py (FastAPI) floodgen.py (parametric floods) score.py (Resilience Index) export.py
web/          React + TypeScript app: src/pages (Landing, Evidence, calculator), src/components, public/data (static JSON)
datasets/     raw (ignored), processed (real, cleaned), synthetic (generated), audit, build and fetch scripts
results/      CSV outputs, METRICS.md, figures/
tests/        44 tests
docs/         DEMO_SCRIPT.md
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the branching convention and how
to propose a change. Good places to start are the issues labelled `good first issue`.

## Team

Team Kernel Panic: Chirag ([@chiragshah2357](https://github.com/chiragshah2357)) and Augustya ([@AugustyaSingh](https://github.com/AugustyaSingh)). What each person built: TBD.

## Licence

MIT. See [LICENSE](LICENSE). Third-party data, code and models keep their own licences; see
[ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md).
