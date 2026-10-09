"""Small statistics helpers for the evaluation (seeded, no external dependencies beyond numpy and scipy)."""
import numpy as np
from scipy import stats


def gini(x) -> float:
    """Gini coefficient of non-negative values (0 = equal, 1 = concentrated in one item)."""
    x = np.sort(np.asarray(x, dtype=float))
    if len(x) == 0 or x.sum() == 0:
        return 0.0
    n = len(x)
    return float((2 * np.arange(1, n + 1) - n - 1) @ x / (n * x.sum()))


def bootstrap_ci(x, n_boot=2000, alpha=0.05, seed=42):
    """Mean and percentile bootstrap confidence interval."""
    x = np.asarray(x, dtype=float)
    x = x[np.isfinite(x)]
    if len(x) == 0:
        return float("nan"), float("nan"), float("nan")
    rng = np.random.default_rng(seed)
    means = rng.choice(x, size=(n_boot, len(x)), replace=True).mean(axis=1)
    return float(x.mean()), float(np.quantile(means, alpha / 2)), float(np.quantile(means, 1 - alpha / 2))


def paired_summary(a, b, n_boot=2000, seed=42) -> dict:
    """Paired comparison of a (treatment) against b (reference) over the same scenarios; lower is better.

    Returns mean difference a-b with bootstrap CI, win rate (a < b), tie rate, and a Wilcoxon signed-rank p-value."""
    a, b = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    d = a - b
    mean, lo, hi = bootstrap_ci(d, n_boot=n_boot, seed=seed)
    nz = d[np.abs(d) > 1e-9]
    p = float(stats.wilcoxon(nz).pvalue) if len(nz) >= 5 else float("nan")
    return {"mean_diff": mean, "ci_low": lo, "ci_high": hi, "win_rate": float((d < -1e-9).mean()),
            "tie_rate": float((np.abs(d) <= 1e-9).mean()), "wilcoxon_p": p, "n": int(len(d))}


def weighted_quantile(values, weights, q):
    values, weights = np.asarray(values, dtype=float), np.asarray(weights, dtype=float)
    order = np.argsort(values)
    v, w = values[order], weights[order]
    cum = np.cumsum(w) / w.sum()
    return float(v[np.searchsorted(cum, q)])
