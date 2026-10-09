# Datasets

All data for the Cachar (Assam) flood-access prototype. **Raw downloads are not committed**; fetch them with
`python datasets/fetch_raw.py`, then build everything with `python datasets/build_datasets.py`.

| Folder | In git? | Contents |
|---|---|---|
| `raw/` | No | Original downloads (see sources below) |
| `processed/cachar.gpkg` | Yes | **Real** Cachar roads, habitations and human-health facilities, cleaned |
| `synthetic/` | Yes | **Generated** stock, depot, fleet and flood scenarios, with `ASSUMPTIONS.md` |
| `audit/` | Yes | Exploratory scripts used to check the data (see `AUDIT.md`) |

## Real data sources

| Data | Source | Licence | Used for |
|---|---|---|---|
| Rural roads, habitations (with population), facilities for Assam | [PMGSY GeoSadak Rural Connectivity Datasets](https://geosadak-pmgsy.nic.in/OpenData), Ministry of Rural Development, accessed via the [datameet mirror](https://github.com/datameet/pmgsy-geosadak) (snapshot of July 2022) | [Government Open Data Licence - India](https://data.gov.in/government-open-data-license-india); attribution required | Road network, villages, facilities |
| Waterways | [OpenStreetMap](https://www.openstreetmap.org/copyright) via the Overpass API | ODbL | Synthetic flood scenarios |
| Terrain | [Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/) (Terrarium, zoom 10) | See the registry page for per-source attribution | Synthetic flood scenarios |
| Population grid | [WorldPop](https://www.worldpop.org/) India 2020, 1 km, UN-adjusted | CC BY 4.0 (check the WorldPop page) | Downloaded as a cross-check; not used by the build yet |

## Synthetic data

`synthetic/` is **generated** by `build_datasets.py` with a fixed seed (42); two runs produce identical files.
It contains stock levels, consumption, a depot, a vehicle fleet and flood scenarios. These validate a *method*
on a simulated district; they are not measurements of any real flood or any real stock. Every parameter and
why it was chosen is in [`synthetic/ASSUMPTIONS.md`](synthetic/ASSUMPTIONS.md). Real and synthetic values are
distinguishable by the `data_origin` column.
