"""Error metrics for height predictions against the buildings that have a mapped height or level count."""
import statistics

LEVEL_M = 3.2
BANDS = [("under 10 m", 0, 10), ("10 to 23 m", 10, 23), ("23 to 60 m", 23, 60), ("over 60 m", 60, float("inf"))]


def metrics(pred, truth):
    """pred, truth: equal-length sequences of metres. bias = mean(pred - truth) (positive = too tall)."""
    n = len(truth)
    if n == 0:
        return {"n": 0}
    err = [p - t for p, t in zip(pred, truth)]
    ab = [abs(e) for e in err]
    return {"n": n,
            "medianAbsErrorM": round(statistics.median(ab), 2),
            "meanAbsErrorM": round(statistics.mean(ab), 2),
            "biasM": round(statistics.mean(err), 2),
            "withinOneStoreyShare": round(sum(a <= LEVEL_M + 1e-9 for a in ab) / n, 3)}


def by_band(pred, truth):
    out = {}
    for label, lo, hi in BANDS:
        idx = [i for i, t in enumerate(truth) if lo <= t < hi]
        out[label] = metrics([pred[i] for i in idx], [truth[i] for i in idx])
    return out
