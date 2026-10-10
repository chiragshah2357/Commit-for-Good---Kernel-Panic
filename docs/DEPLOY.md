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

## What was checked

- `vercel.json` validates against Vercel's published schema (`https://openapi.vercel.sh/vercel.json`).
- In a clean environment with only the `pyproject.toml` dependencies (393 MB installed, against about 657 MB for the full
  `requirements.txt`), the engine loads in about 1.3 s, `/api/simulate` returns the expected result and the 60-flood ensemble
  takes about 2 s. None of the excluded packages are imported.
- **The production deployment from `main` succeeded** (10 October 2026). On <https://commit-for-good-kernel-panic.vercel.app>:
  `/`, `/evidence` and `/calculator` all return 200 (so the `index.html` fallback works), the JavaScript, CSS and
  `/data/*.json` files load, `/api/health` returns `{"ok":true,...}` (engine load about 1.5 s), `POST /api/simulate` returns the
  expected 715,833 residents cut off in about 1.3 s, and `/api/ensemble`, `/api/pareto` and `/api/uncertainty` answer in about
  3, 3.4 and 1.2 s. Services is a beta feature, so re-check after Vercel changes anything.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| The Vercel check fails on a pull request, but `main` deploys fine | The branch was created before `vercel.json` was merged into `main`, so it has no Vercel configuration and the Services preset has nothing to build | Update the branch with `main` (the **Update branch** button on the pull request, or `git merge origin/main`) |
| A deployment URL redirects to a Vercel login page | Preview and per-deployment URLs sit behind Vercel's Deployment Protection | Sign in to Vercel, or use the public production domain |
| `/docs` (the FastAPI interactive docs) shows the web app instead | Only `/api/*` is routed to the API on Vercel | Use `/docs` locally with `python -m floodready serve` |
| The build fails on bundle size | A Python function is capped at 500 MB | Trim `pyproject.toml` further |
| A long request times out | The function's default maximum duration | Raise `maxDuration` for the `app` service under its `functions` key |

To run everything locally in one process instead: `cd web && npm install && npm run build`, then `python -m floodready serve`.
