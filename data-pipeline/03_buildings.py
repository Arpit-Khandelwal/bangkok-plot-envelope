"""Overture buildings for a bbox -> public/data/buildings.geojson with h / hSrc / cls.

usage: python -I 03_buildings.py [--bbox minLon,minLat,maxLon,maxLat] [--release 2026-11-18.0] [--refresh]
"""
import argparse
import collections
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # python -I drops the script dir

from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.geometry.polygon import orient

from common import add_common_args, now_iso, r6, resolve_bbox, to_utm, to_wgs, write_json
from heights import LEVEL_M, Estimator, evaluate

MIN_AREA_M2 = 12
SIMPLIFY_M = 0.6       # metres; Douglas-Peucker, topology-preserving (0 disables). Keeps the file small.
H_MIN, H_MAX = 2.0, 330.0   # explicit heights outside this range are treated as bad data


def run_cli(args):
    exe = shutil.which("overturemaps") or str(Path(sys.executable).parent / "overturemaps")
    subprocess.run([exe, *args], check=True)


def download(kind, bbox, release, raw: Path, refresh):
    if raw.exists() and raw.stat().st_size > 0 and not refresh:
        return
    raw.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["download", f"--bbox={','.join(map(str, bbox))}", "-f", "geojson", f"--type={kind}", "-o", str(raw)]
    if release:
        cmd += ["--release", release]
    run_cli(cmd)


def release_of(raw: Path):
    st = Path(str(raw) + ".state")
    return json.loads(st.read_text())["last_release"] if st.exists() else None


def num(v):
    try:
        v = float(v)
        return v if v == v else None
    except (TypeError, ValueError):
        return None


def main():
    ap = argparse.ArgumentParser()
    add_common_args(ap)
    ap.add_argument("--release", default=None, help="pin an Overture release (default: latest)")
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--simplify", type=float, default=SIMPLIFY_M, help="simplify tolerance in metres (0=off)")
    a = ap.parse_args()
    out, work = Path(a.out), Path(a.work)
    bbox = resolve_bbox(a.bbox, work)
    raw = work / "raw" / "overture_buildings.geojson"
    download("building", bbox, a.release, raw, a.refresh)
    feats = json.loads(raw.read_text(encoding="utf-8"))["features"]

    recs, known = [], []
    drop = collections.Counter()
    for f in feats:
        p = f.get("properties", {})
        if p.get("is_underground"):
            drop["underground"] += 1
            continue
        g = shape(f["geometry"])
        ug = to_utm(g)
        area = ug.area
        if area < MIN_AREA_M2:
            drop["footprint_lt_12m2"] += 1
            continue
        h, nf = num(p.get("height")), num(p.get("num_floors"))
        if h is not None and not (H_MIN <= h <= H_MAX):
            drop["bad_explicit_height_ignored"] += 1
            h = None
        if nf is not None and not (1 <= nf <= 100):
            nf = None
        cls, sub = p.get("class"), p.get("subtype")
        if h is not None:
            src, hv = "height", h
        elif nf is not None:
            src, hv = "levels", nf * LEVEL_M
        else:
            src, hv = "est", None
        if hv is not None:
            known.append((area, cls, sub, hv))
        recs.append((g, ug, area, hv, src, cls or sub))

    est = Estimator(known)
    stats = evaluate(known)
    stats["cell_counts_used_for_calibration"] = {f"{g}|bin{b}": n for (g, b), n in sorted(est.cell_n.items())}
    stats["calibrated_levels_table"] = {g: [round(v, 2) for v in row] for g, row in est.table.items()}

    out_feats, cnt = [], collections.Counter()
    for g, ug, area, hv, src, cls in recs:
        cls_raw = cls
        if hv is None:
            hv = est.height(area, *cls_pair(cls_raw))
        if a.simplify:
            sg = ug.simplify(a.simplify, preserve_topology=True)
            if sg.is_valid and not sg.is_empty and sg.area > 0.8 * area:
                g = to_wgs(sg)
        if isinstance(g, Polygon):
            g = orient(g, 1.0)
        elif isinstance(g, MultiPolygon):
            g = MultiPolygon([orient(p, 1.0) for p in g.geoms])
        props = {"h": round(hv, 1), "hSrc": src}
        if cls:
            props["cls"] = cls
        out_feats.append({"type": "Feature", "properties": props, "geometry": r6(mapping(g))})
        cnt[src] += 1

    nbytes = write_json(out / "buildings.geojson", {"type": "FeatureCollection", "features": out_feats})
    n = len(out_feats)
    summary = {"bbox": bbox, "release": release_of(raw), "count": n, "bytes": nbytes, "dropped": dict(drop),
               "raw_count": len(feats), "hSrc_counts": dict(cnt),
               "hSrc_pct": {k: round(100 * v / n, 2) for k, v in cnt.items()}, "heuristic": stats,
               "sources": dict(collections.Counter(s["dataset"] for f in feats for s in f["properties"].get("sources", [])))}
    write_json(work / "buildings_summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=1))


def cls_pair(c):
    """Estimator takes (class, subtype); we carry one merged label, so try it as both."""
    return c, c


if __name__ == "__main__":
    main()
