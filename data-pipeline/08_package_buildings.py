"""Split public/data/buildings.geojson into spatial chunks under 900 KB: public/data/buildings/part-NN.geojson + index.json.

Method: a regular GRID x GRID grid over the study bbox; each building goes to the cell holding its representative
point (so it appears in exactly one part); any cell whose file would exceed the budget is bisected along its longer
side until every leaf fits. Cell bounds are for assignment only; the bbox written to index.json is the tight extent
of the part's geometries, so a client can cull parts against the viewport.

usage: python -I 08_package_buildings.py [--grid 3] [--budget 880000]
"""
import argparse
import collections
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # python -I drops the script dir

from shapely.geometry import shape

from common import add_common_args, now_iso, resolve_bbox, write_json

MAX_PART_BYTES = 900_000      # hard limit (uncompressed); pre-commit rule is 1 MB
WRAPPER = '{"type":"FeatureCollection","features":[]}'


def dumps(o) -> str:
    return json.dumps(o, ensure_ascii=False, separators=(",", ":"))


def collection(strs) -> str:
    return '{"type":"FeatureCollection","features":[' + ",".join(strs) + "]}"


def size_of(items) -> int:
    return len(WRAPPER.encode()) + sum(len(s.encode()) for _, _, s in items) + max(len(items) - 1, 0)


def bisect(cell, items, budget):
    """cell=(x0,y0,x1,y1); items=[(x,y,json_str)] -> list of leaf item lists (south/west first)."""
    if not items:
        return []
    if size_of(items) <= budget:
        return [items]
    x0, y0, x1, y1 = cell
    if x1 - x0 >= y1 - y0:
        m = (x0 + x1) / 2
        halves = [((x0, y0, m, y1), [i for i in items if i[0] < m]), ((m, y0, x1, y1), [i for i in items if i[0] >= m])]
    else:
        m = (y0 + y1) / 2
        halves = [((x0, y0, x1, m), [i for i in items if i[1] < m]), ((x0, m, x1, y1), [i for i in items if i[1] >= m])]
    if any(not h for _, h in halves) and all(i[:2] == items[0][:2] for i in items):
        raise SystemExit("cannot split further: identical representative points exceed the budget")
    out = []
    for c, h in halves:
        out += bisect(c, h, budget)
    return out


def main():
    ap = argparse.ArgumentParser()
    add_common_args(ap)
    ap.add_argument("--grid", type=int, default=3, help="initial regular grid size (GRID x GRID)")
    ap.add_argument("--budget", type=int, default=880_000, help="target bytes per part (must be <= 900000)")
    ap.add_argument("--source", default=None)
    a = ap.parse_args()
    assert a.budget <= MAX_PART_BYTES
    out, work = Path(a.out), Path(a.work)
    bbox = resolve_bbox(a.bbox, work)
    feats = json.loads((out / "buildings.geojson").read_text(encoding="utf-8"))["features"]

    cells = collections.defaultdict(list)
    cw, ch = (bbox[2] - bbox[0]) / a.grid, (bbox[3] - bbox[1]) / a.grid
    for f in feats:
        p = shape(f["geometry"]).representative_point()
        gx = min(max(int((p.x - bbox[0]) // cw), 0), a.grid - 1)
        gy = min(max(int((p.y - bbox[1]) // ch), 0), a.grid - 1)
        cells[(gy, gx)].append((p.x, p.y, dumps({"type": "Feature", "properties": f["properties"], "geometry": f["geometry"]})))
    leaves = []
    for (gy, gx) in sorted(cells):
        cell = (bbox[0] + gx * cw, bbox[1] + gy * ch, bbox[0] + (gx + 1) * cw, bbox[1] + (gy + 1) * ch)
        leaves += bisect(cell, cells[(gy, gx)], a.budget)

    pdir = out / "buildings"
    pdir.mkdir(parents=True, exist_ok=True)
    for old in pdir.glob("part-*.geojson"):
        old.unlink()
    parts, ids, seen = [], 0, collections.Counter()
    for k, items in enumerate(leaves):
        name = f"part-{k:02d}.geojson"
        text = collection(s for _, _, s in items)
        assert len(text.encode()) <= MAX_PART_BYTES
        (pdir / name).write_text(text, encoding="utf-8")
        xs, ys = [], []
        for _, _, s in items:
            b = shape(json.loads(s)["geometry"]).bounds
            xs += [b[0], b[2]]
            ys += [b[1], b[3]]
            seen[s] += 1
        parts.append({"file": name, "bbox": [min(xs), min(ys), max(xs), max(ys)], "count": len(items), "bytes": len(text.encode())})
        ids += len(items)
    assert ids == len(feats), (ids, len(feats))
    n = len(feats)
    cnt = collections.Counter(f["properties"]["hSrc"] for f in feats)
    src = a.source or "Overture Maps footprints; heights: explicit height > level count x 3.2 m > Google Open Buildings 2.5D Temporal (sat) > footprint heuristic (est)"
    index = {"parts": parts, "total": n, "hSrcPercent": {k: round(100 * v / n, 2) for k, v in cnt.items()},
             "source": src, "generatedAt": now_iso()}
    write_json(pdir / "index.json", index)
    sizes = [p["bytes"] for p in parts]
    summary = {"parts": len(parts), "minBytes": min(sizes), "maxBytes": max(sizes), "totalBytes": sum(sizes), "grid": a.grid,
               "budget": a.budget}
    write_json(work / "package_summary.json", summary)
    print(json.dumps(summary))
    for p in parts:
        print(p["file"], p["count"], p["bytes"], [round(v, 4) for v in p["bbox"]])


if __name__ == "__main__":
    main()
