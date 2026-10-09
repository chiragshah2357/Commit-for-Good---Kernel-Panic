import numpy as np

from floodready.metrics import bootstrap_ci, gini, paired_summary, weighted_quantile


def test_gini_extremes():
    assert gini([5, 5, 5, 5]) == 0.0
    assert gini([0, 0, 0, 10]) > 0.7
    assert gini([]) == 0.0


def test_bootstrap_ci_contains_mean_and_is_seeded():
    x = np.arange(1, 21, dtype=float)
    m, lo, hi = bootstrap_ci(x)
    assert lo <= m <= hi and np.isclose(m, 10.5)
    assert bootstrap_ci(x) == (m, lo, hi)  # same seed, same answer


def test_paired_summary_detects_a_consistent_improvement():
    b = np.arange(10, 40, dtype=float)
    r = paired_summary(b - 5, b)
    assert r["mean_diff"] == -5 and r["win_rate"] == 1.0 and r["wilcoxon_p"] < 0.001 and r["ci_high"] < 0


def test_paired_summary_ties():
    r = paired_summary([1, 2, 3], [1, 2, 3])
    assert r["tie_rate"] == 1.0 and np.isnan(r["wilcoxon_p"])


def test_weighted_quantile():
    assert weighted_quantile([1, 2, 3], [1, 1, 8], 0.5) == 3
