"""Clean the Bangkok zoning GeoJSON, pick the study-area zone, write the study bbox.

usage: python -I 01_zones.py --src kns_zoning.geojson [--out DIR] [--work DIR]
"""
import argparse
import collections
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # python -I drops the script dir

from shapely import make_valid, set_precision
from shapely.geometry import MultiPolygon, Point, Polygon, mapping, shape
from shapely.geometry.polygon import orient

from common import CONFIG, add_common_args, now_iso, r6, to_utm, to_wgs, write_json


def polys_of(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, MultiPolygon):
        return list(g.geoms)
    return [p for x in getattr(g, "geoms", []) for p in polys_of(x)]


def fix(geom):
    """Make valid, keep polygonal parts only."""
    g = geom if geom.is_valid else make_valid(geom)
    return polys_of(g)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    add_common_args(ap)
    a = ap.parse_args()
    out, work = Path(a.out), Path(a.work)
    work.mkdir(parents=True, exist_ok=True)
    minx, miny, maxx, maxy = CONFIG["bangkokBounds"]
    min_area = CONFIG["minZoneAreaM2"]

    src = json.loads(Path(a.src).read_text(encoding="utf-8"))["features"]
    before = collections.Counter(f["properties"].get("zone") for f in src)
    log = collections.Counter()
    kept = []
    for i, f in enumerate(src):
        g = shape(f["geometry"])
        x0, y0, x1, y1 = g.bounds
        if x0 < minx or x1 > maxx or y0 < miny or y1 > maxy:
            log["dropped_outside_bangkok"] += 1
            continue
        invalid = not g.is_valid
        parts = fix(g)
        good = []
        for p in parts:
            if to_utm(p).area < min_area:
                log["dropped_sliver_parts"] += 1
                continue
            good.append(orient(p, 1.0))  # RFC 7946: exterior CCW
        if invalid:
            log["repaired_invalid"] += 1
        if not good:
            log["dropped_features_below_min_area"] += 1
            continue
        geom = good[0] if len(good) == 1 else MultiPolygon(good)
        kept.append({"src": i, "zone": f["properties"]["zone"],
                     "category": f["properties"].get("category"), "geom": geom})

    def snap(g):
        """Snap to the 1e-6 degree grid (valid-output mode), keep CCW polygonal parts only."""
        ps = [orient(q, 1.0) for q in polys_of(set_precision(g, 1e-6)) if not q.is_empty]
        return ps[0] if len(ps) == 1 else MultiPolygon(ps)

    def build(tol_m):
        feats = []
        for k in kept:
            g = k["geom"]
            if tol_m:
                g = to_wgs(to_utm(g).simplify(tol_m, preserve_topology=True))
                g = make_valid(g) if not g.is_valid else g
            gd = r6(mapping(snap(g)))
            feats.append({"type": "Feature", "id": k["src"],
                          "properties": {"id": k["src"], "zone": k["zone"], "category": k["category"],
                                         "planVersion": CONFIG["planVersion"]},
                          "geometry": gd})
        return {"type": "FeatureCollection", "features": feats}

    fc = build(0)
    size = len(json.dumps(fc, ensure_ascii=False, separators=(",", ":")).encode())
    simplified = False
    if size > CONFIG["zoneMaxBytes"]:
        fc = build(CONFIG["zoneSimplifyToleranceM"])
        simplified = True
    # parsed-back geometry must be valid after the 6 dp round-trip
    for ft in fc["features"]:
        if not shape(ft["geometry"]).is_valid:
            raise SystemExit(f"zone {ft['id']} invalid after snapping")
    nbytes = write_json(out / "zones.geojson", fc)
    after = collections.Counter(f["properties"]["zone"] for f in fc["features"])

    # study zone
    seed = Point(*CONFIG["studyZone"]["seedPoint"])
    cands = [f for f in fc["features"]
             if f["properties"]["zone"] == CONFIG["studyZone"]["code"] and shape(f["geometry"]).buffer(0).contains(seed)]
    if len(cands) != 1:
        raise SystemExit(f"expected exactly 1 study zone containing seed point, got {len(cands)}")
    sz = cands[0]
    ug = to_utm(shape(sz["geometry"]))
    margin = CONFIG["marginMetres"]
    bb = to_wgs(ug.envelope.buffer(margin, join_style=2)).bounds
    bbox = [round(bb[0], 6), round(bb[1], 6), round(bb[2], 6), round(bb[3], 6)]
    study = {"zoneId": sz["properties"]["id"], "zone": sz["properties"]["zone"],
             "zoneAreaM2": round(ug.area), "zoneBounds": [round(v, 6) for v in shape(sz["geometry"]).bounds],
             "marginMetres": margin, "bbox": bbox, "generatedAt": now_iso()}
    write_json(work / "study.json", study)

    summary = {"bytes": nbytes, "simplified": simplified, "features_before": len(src),
               "features_after": len(fc["features"]), "log": dict(log), "study": study,
               "counts_before": dict(sorted(before.items())), "counts_after": dict(sorted(after.items()))}
    write_json(work / "zones_summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
