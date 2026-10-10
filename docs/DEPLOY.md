# Deploying to Vercel

The calculator needs the Python engine, so the whole app (static pages and API) is deployed as one Vercel project using
[Vercel Services](https://vercel.com/docs/services). No environment variables or API keys are needed.

## How it is wired

[`vercel.json`](../vercel.json) defines two services and the routes that expose them:

| Service | Root | What it is | Public paths |
|---|---|---|---|
| `web` | `web/` | The React + Vite app (Brief, Evidence, Calculator) | everything except `/api/*` |
| `app` | `.` | The FastAPI app, `floodready.api:app` | `/api/*` |

Vercel passes the original path to a service, so the app's `/api/simulate` route works unchanged. The `web` service falls back to
`index.html` so that client-side routes such as `/calculator` and `/evidence` survive a refresh.

[`pyproject.toml`](../pyproject.toml) lists only what the API needs at run time (FastAPI, GeoPandas, SciPy and their dependencies),
at the same versions as `requirements.txt`. A Python function on Vercel is capped at 500 MB, and the rest of `requirements.txt`
(rasterio, matplotlib, pillow, networkx, pytest) is for the data pipeline, the report and the tests. Local development is unchanged:
`pip install -r requirements.txt`. [`.python-version`](../.python-version) selects Python 3.13.

## Steps

1. Merge to `main`, then in Vercel choose **Add New > Project** and import the repository.
2. Keep the detected settings (Application Preset **Services**, Root Directory `./`). Deploy.
3. Open the deployment URL. The Calculator header should show **API online**.

## What was checked, and what was not

- `vercel.json` validates against Vercel's published schema (`https://openapi.vercel.sh/vercel.json`).
- In a clean environment with only the `pyproject.toml` dependencies (393 MB installed, against about 657 MB for the full
  `requirements.txt`), the engine loads in about 1.3 s, `/api/simulate` returns the expected result and the 60-flood ensemble
  takes about 2 s. None of the excluded packages are imported.
- **Not checked:** an actual Vercel build. Services is a beta feature. If the build fails on bundle size, trim `pyproject.toml`
  further; if a long request times out, raise `maxDuration` for the `app` service under its `functions` key.

To run everything locally in one process instead: `cd web && npm install && npm run build`, then `python -m floodready serve`.
