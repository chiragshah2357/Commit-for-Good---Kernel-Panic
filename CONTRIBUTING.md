# Contributing

Thanks for your interest in this project. It was started at the COMMIT FOR GOOD hackathon (October 2026) and is
meant to be picked up and continued by others. This guide explains how to get set up and how changes are made.

The project models how floods cut road access to health facilities in Cachar, Assam, and how limited medicine stock
should then be allocated. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first: it explains the modules, the models and
where the design is deliberately simple. Floods and stock levels are generated data and are declared as such; keep that
distinction clear in anything you add.

## Getting started

1. Fork the repository (or, if you are a team member, clone it).
2. Install Python 3.13 (the pinned versions in `requirements.txt` were developed on it).
3. Create a virtual environment and install dependencies:

   ```bash
   python -m venv .venv
   source .venv/bin/activate      # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. Run the tests: `pytest` (44 tests). The cleaned data and generated scenarios are committed, so nothing needs
   downloading.
5. For the web app, install Node 20 or newer, then `cd web && npm install`. `python -m floodready serve` starts the API
   on http://localhost:8000 and `npm run dev` serves the app with hot reload on http://localhost:5173 (it proxies `/api`).
   `npm run build` type-checks and builds.
6. `.env.example` currently has no variables, because nothing needs a key. If you add one, add its name there and never
   commit `.env`.

## Branching: one workflow, one branch

Every distinct piece of work gets exactly one branch, and one pull request. Do not create ad-hoc or personal
branches, and do not mix unrelated changes in one branch.

Branch names use a type prefix and a short description of the workflow:

| Prefix | Use for |
|---|---|
| `feat/` | New functionality |
| `fix/` | Bug fixes |
| `data/` | Data sourcing, generation scripts, assumptions |
| `docs/` | Documentation, write-ups, diagrams |
| `chore/` | Repository setup, tooling, CI, dependencies |
| `test/` | Tests and evaluation harnesses |

Example: `data/synthetic-network-generator`. `main` always holds the latest reviewed work. Releases are tagged
(`v1.0`, ...) from `main`.

## Commits

- Small, frequent commits, each saying what changed: `feat: rank destinations by predicted price`, not `update`.
- Use a type prefix matching the branch types above.
- Do not commit secrets, API keys, or large third-party datasets. Write a download script and document the source
  and licence in the README instead.

## Pull requests

- Open a PR against `main` using the PR template.
- Explain what changed and why, and how you tested it.
- Keep a PR to one workflow so it is easy to review.
- Credit any code, data or model you did not write in `ACKNOWLEDGEMENTS.md`, and note its licence.

## Data and licensing

By contributing you agree your contribution is licensed under the project's MIT licence. Third-party datasets
and model weights keep their own licences, which you cannot change: record the source and licence of anything
you add. Generated or synthetic data must be declared as such, with the generation script, a fixed random seed,
and an assumptions table.

## Reporting bugs and proposing features

Open an issue using the templates. For anything larger than a small fix, please open an issue first so the
approach can be discussed before you invest time. Issues labelled `good first issue` are a good starting point.

## Conduct

Be respectful and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
