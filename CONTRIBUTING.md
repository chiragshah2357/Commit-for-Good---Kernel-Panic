# Contributing

Thanks for your interest in this project. It was started at the COMMIT FOR GOOD hackathon (October 2026) and is
meant to be picked up and continued by others. This guide explains how to get set up and how changes are made.

> The project's problem statement and code are still being defined. Setup commands below are filled in as the
> code lands; until then, the branching and commit rules already apply.

## Getting started

1. Fork the repository (or, if you are a team member, clone it).
2. Install Python 3.10 or newer.
3. Create a virtual environment and install dependencies:

   ```bash
   python -m venv .venv
   source .venv/bin/activate      # Windows: .venv\Scripts\activate
   pip install -r requirements.txt   # added with the first code
   ```

4. Copy `.env.example` to `.env` and fill in any values you need. Never commit `.env`.
5. Run the tests (once they exist): `pytest`.

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
