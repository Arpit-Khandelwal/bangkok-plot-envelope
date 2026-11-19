"""Replace guessed heights with satellite-derived ones (Google Open Buildings 2.5D Temporal), then evaluate.

Reads work/buildings_base.geojson (from 03), samples the building_height raster inside each footprint, assigns
h/hSrc with priority  height > levels > sat > est, evaluates the sampled height against the buildings that have a
mapped height / level count, and writes public/data/buildings.geojson (h, hSrc only) + work/sat_summary.json.

usage: python -I 07_sat_heights.py [--year 2023] [--stat p90_pos] [--refresh]
"""
import argparse
import collections
import json
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # python -I drops the script dir

import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.windows import Window
from shapely.geometry import shape

from common import add_common_args, now_iso, resolve_bbox, to_utm, write_json
from evaluation import BANDS, by_band, metrics
from heights import Estimator
from sat_raster import fetch_window

H_FLOOR = 3.0
CAP_M = 99.0            # raster maximum is 99 or 100 m; pixels at or above this are saturated
STATS = {               # statistic name -> (percentile or "max", positive_pixels_only)
    "p50_pos": (50, True), "p75_pos": (75, True), "p90_pos": (90, True), "max_pos": ("max", True),
    "p50_all": (50, False), "p75_all": (75, False), "p90_all": (90, False), "max_all": ("max", False),
}
DEFAULT_STAT = "p90_pos"


def stat_of(vals: np.ndarray, spec) -> float | None:
    q, positive_only = spec
    v = vals[vals > 0] if positive_only else vals
    if v.size == 0:
        return None
    return float(v.max()) if q == "max" else float(np.percentile(v, q))


def sample_footprints(feats, tif: Path):
    """For every footprint: {stat name: value or None}, pixel count, method ('mask'|'touched'|'centroid'|'none')."""
    with rasterio.open(tif) as ds:
        arr = ds.read(1)
        tf, nodata = ds.transform, ds.nodata
    arr = np.where(arr == nodata, 0.0, arr)
    res, rows, cols = [], arr.shape[0], arr.shape[1]
    for f in feats:
        ug = to_utm(shape(f["geometry"]))
        x0, y0, x1, y1 = ug.bounds
        c0, r0 = ~tf * (x0, y1)
        c1, r1 = ~tf * (x1, y0)
        c0, r0, c1, r1 = max(int(c0) - 1, 0), max(int(r0) - 1, 0), min(int(c1) + 2, cols), min(int(r1) + 2, rows)
        if c1 <= c0 or r1 <= r0:
            res.append(({k: None for k in STATS}, 0, "none"))
            continue
        win = Window(c0, r0, c1 - c0, r1 - r0)
        sub, wtf = arr[r0:r1, c0:c1], rasterio.windows.transform(win, tf)
        method = "mask"
        for touched in (False, True):
            m = rasterize([(ug, 1)], out_shape=sub.shape, transform=wtf, all_touched=touched).astype(bool)
            if m.any():
                method = "touched" if touched else "mask"
                vals = sub[m]
                break
        else:
            cx, cy = ug.centroid.x, ug.centroid.y
            cc, rr = ~tf * (cx, cy)
            cc, rr = int(cc), int(rr)
            vals = np.array([arr[rr, cc]]) if 0 <= rr < rows and 0 <= cc < cols else np.array([])
            method = "centroid"
        res.append(({k: stat_of(vals, s) for k, s in STATS.items()}, int(vals.size), method))
    return res


def known_set(feats):
    """Indices, truth heights and (area, cls) of buildings with a mapped height or level count."""
    idx = [i for i, f in enumerate(feats) if f["properties"]["hSrc"] in ("height", "levels")]
    return idx, [feats[i]["properties"]["h"] for i in idx]


def heuristic_predictions(feats, idx):
    """Heuristic height for the known buildings: 5-fold out-of-fold (honest) and in-sample (as in 03)."""
    known = [(feats[i]["properties"]["area"], feats[i]["properties"].get("cls"), feats[i]["properties"].get("cls"),
              feats[i]["properties"]["h"]) for i in idx]
    full = Estimator(known)
    insample = [full.height(a, c, s) for a, c, s, _ in known]
    cv = [0.0] * len(known)
    for k in range(5):
        est = Estimator([x for j, x in enumerate(known) if j % 5 != k])
        for j, (a, c, s, _) in enumerate(known):
            if j % 5 == k:
                cv[j] = est.height(a, c, s)
    return insample, cv


def evaluate(feats, samples, stat, idx, truth):
    ins, cv = heuristic_predictions(feats, idx)
    have = [j for j, i in enumerate(idx) if samples[i][0][stat] is not None]
    pick = lambda xs: [xs[j] for j in have]  # noqa: E731
    sat = [max(H_FLOOR, samples[idx[j]][0][stat]) for j in have]
    t = pick(truth)
    med = statistics.median(truth)
    return {
        "truthN": len(truth), "truthWithSatValue": len(have),
        "sat": {"overall": metrics(sat, t), "byBand": by_band(sat, t)},
        "heuristicOutOfFold": {"overall": metrics(pick(cv), t), "byBand": by_band(pick(cv), t)},
        "heuristicInSample": {"overall": metrics(pick(ins), t), "byBand": by_band(pick(ins), t)},
        "constantMedian": {"valueM": round(med, 1), "overall": metrics([med] * len(t), t),
                           "byBand": by_band([med] * len(t), t)},
    }


def main():
    ap = argparse.ArgumentParser()
    add_common_args(ap)
    ap.add_argument("--year", type=int, default=2023)
    ap.add_argument("--stat", default=DEFAULT_STAT, choices=sorted(STATS))
    ap.add_argument("--refresh", action="store_true")
    a = ap.parse_args()
    out, work = Path(a.out), Path(a.work)
    bbox = resolve_bbox(a.bbox, work)
    feats = json.loads((work / "buildings_base.geojson").read_text(encoding="utf-8"))["features"]
    tif, info = fetch_window(bbox, a.year, work, refresh=a.refresh)
    samples = sample_footprints(feats, tif)

    idx, truth = known_set(feats)
    # 1. which statistic? every candidate scored on the same ground truth (selection uses the same 192 points,
    #    so the chosen figure is slightly optimistic; see the split-half check below)
    table = {}
    for name in STATS:
        have = [j for j, i in enumerate(idx) if samples[i][0][name] is not None]
        pred = [max(H_FLOOR, samples[idx[j]][0][name]) for j in have]
        table[name] = {**metrics(pred, [truth[j] for j in have])}
    half = {}
    for name in STATS:
        for part, sel in (("even", 0), ("odd", 1)):
            js = [j for j, i in enumerate(idx) if j % 2 == sel and samples[i][0][name] is not None]
            half.setdefault(name, {})[part] = metrics([max(H_FLOOR, samples[idx[j]][0][name]) for j in js],
                                                      [truth[j] for j in js])["meanAbsErrorM"]
    evaluation = evaluate(feats, samples, a.stat, idx, truth)

    # 2. assign
    out_feats, cnt, capped, methods = [], collections.Counter(), 0, collections.Counter()
    for f, (st, npx, method) in zip(feats, samples):
        p = f["properties"]
        if p["hSrc"] in ("height", "levels"):
            h, src = p["h"], p["hSrc"]
        elif st[a.stat] is not None:
            h, src = st[a.stat], "sat"
            capped += st["max_pos"] is not None and st["max_pos"] >= CAP_M
            methods[method] += 1
        else:
            h, src = p["h"], "est"
        out_feats.append({"type": "Feature", "properties": {"h": round(max(H_FLOOR, h), 1), "hSrc": src},
                          "geometry": f["geometry"]})
        cnt[src] += 1
    n = len(out_feats)
    sat_h = [f["properties"]["h"] for f in out_feats if f["properties"]["hSrc"] == "sat"]
    nbytes = write_json(out / "buildings.geojson", {"type": "FeatureCollection", "features": out_feats})
    summary = {
        "generatedAt": now_iso(), "count": n, "bytes": nbytes, "hSrcCounts": dict(cnt),
        "hSrcPercent": {k: round(100 * v / n, 2) for k, v in cnt.items()},
        "raster": info, "statistic": a.stat, "floorM": H_FLOOR, "capM": CAP_M,
        "satPixelMethods": dict(methods),
        "satBuildingsTouchingCap": int(capped),
        "satBuildingsWithValueAtLeast99": int(sum(h >= CAP_M for h in sat_h)),
        "satHeightPercentilesM": {str(q): round(float(np.percentile(sat_h, q)), 1) for q in (5, 25, 50, 75, 95, 99)},
        "statisticComparison": table, "statisticSplitHalfMeanAbsErrorM": half, "evaluation": evaluation,
    }
    write_json(work / "sat_summary.json", summary)
    print(json.dumps({k: summary[k] for k in ("hSrcPercent", "satPixelMethods", "satBuildingsTouchingCap",
                                              "satBuildingsWithValueAtLeast99", "satHeightPercentilesM")}, indent=1))
    print("statistic comparison (truth n=%d):" % len(truth))
    for k, v in table.items():
        print(f"  {k:8s} {v}   half(even/odd MAE)={half[k]['even']}/{half[k]['odd']}")
    print(json.dumps(evaluation, indent=1))


if __name__ == "__main__":
    main()
