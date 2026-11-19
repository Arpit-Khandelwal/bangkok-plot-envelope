"""Parse every output back and check it.  usage: python -I 06_validate.py  (exit 1 on failure)"""
import argparse
import collections
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # python -I drops the script dir

from shapely.geometry import Point, box, shape
from shapely.validation import explain_validity

from common import CONFIG, add_common_args, to_utm

FAILS = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        FAILS.append(msg)


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def coords_ok(g, nd=6):
    def rec(c):
        if isinstance(c[0], (int, float)):
            return all(round(v, nd) == v for v in c)
        return all(rec(x) for x in c)
    return rec(g["coordinates"])


def main():
    ap = argparse.ArgumentParser()
    add_common_args(ap)
    a = ap.parse_args()
    out = Path(a.out)
    meta = load(out / "meta.json")
    bb = meta["study"]["bbox"]
    bbox = box(*bb)

    z = load(out / "zones.geojson")["features"]
    check(all(shape(f["geometry"]).is_valid for f in z), f"zones: all {len(z)} geometries valid")
    check(all(coords_ok(f["geometry"]) for f in z), "zones: coords rounded to 6 dp")
    check(all(set(f["properties"]) == {"id", "zone", "category", "planVersion"} for f in z), "zones: property set")
    check(len({f["properties"]["id"] for f in z}) == len(z), "zones: unique ids")
    minx, miny, maxx, maxy = CONFIG["bangkokBounds"]
    check(all(minx <= shape(f["geometry"]).bounds[0] and shape(f["geometry"]).bounds[2] <= maxx for f in z), "zones: inside Bangkok bounds")
    check(min(to_utm(shape(f["geometry"])).area for f in z) >= CONFIG["minZoneAreaM2"], "zones: no polygon below min area")
    from shapely.geometry import Polygon
    ccw = all(Polygon(p.exterior).exterior.is_ccw for f in z for p in getattr(shape(f["geometry"]), "geoms", [shape(f["geometry"])]))
    check(ccw, "zones: exterior rings CCW (RFC 7946)")
    cnt = collections.Counter(f["properties"]["zone"] for f in z)
    check(cnt["ย.7"] == 30 and cnt["พ.5"] == 7, f"zones: ย.7={cnt['ย.7']} (plan: 30), พ.5={cnt['พ.5']} (plan: 7)")

    zid = meta["study"]["zoneId"]
    zone = next(f for f in z if f["properties"]["id"] == zid)
    check(zone["properties"]["zone"] == "ย.7", "study zone is ย.7")
    zg = shape(zone["geometry"])
    check(box(*meta["study"]["zoneBounds"]).buffer(1e-5).contains(zg), "study zoneBounds match polygon")

    s = load(out / "stations.geojson")["features"]
    check(all(shape(f["geometry"]).is_valid for f in s), f"stations: all {len(s)} geometries valid")
    check(all(f["properties"]["geomSource"] in ("platform", "node") for f in s), "stations: geomSource values")
    check(all((f["properties"]["geomSource"] == "node") == (f["geometry"]["type"] == "Point") for f in s), "stations: Point iff node")
    check(all(f["geometry"]["type"] in ("Point", "MultiPolygon", "MultiLineString") for f in s), "stations: geometry types")
    for ref in ("E10", "E11"):
        f = next((x for x in s if x["properties"]["ref"] == ref), None)
        check(f is not None, f"station {ref} present ({f['properties']['name'] if f else '-'}, {f['geometry']['type'] if f else '-'})")
        if f:
            check(zg.contains(shape(f["geometry"])), f"study zone polygon contains whole {ref} geometry")
            check(zg.contains(Point(f["properties"]["nodeLon"], f["properties"]["nodeLat"])), f"study zone contains {ref} node")

    b = load(out / "buildings.geojson")["features"]
    bad = [i for i, f in enumerate(b) if not shape(f["geometry"]).is_valid]
    check(not bad, f"buildings: all {len(b)} geometries valid ({len(bad)} invalid)")
    check(all(isinstance(f["properties"]["h"], (int, float)) and f["properties"]["hSrc"] in ("height", "levels", "est") for f in b), "buildings: h numeric, hSrc enum")
    check(all(set(f["properties"]) <= {"h", "hSrc", "cls"} for f in b), "buildings: only h/hSrc/cls")
    check(all(coords_ok(f["geometry"]) for f in b), "buildings: coords rounded to 6 dp")
    check(all(bbox.buffer(0.01).intersects(shape(f["geometry"])) for f in b), "buildings: inside study bbox")
    hs = [f["properties"]["h"] for f in b]
    check(min(hs) >= 2 and max(hs) <= 330, f"buildings: h range {min(hs)}..{max(hs)}")

    r = load(out / "roads.geojson")["features"]
    check(all(shape(f["geometry"]).is_valid for f in r), f"roads: all {len(r)} geometries valid")
    check(all(f["properties"]["widthSrc"] in ("tag", "est") and f["properties"]["widthEst"] > 0 for f in r), "roads: widthEst/widthSrc")
    check(all(f["geometry"]["type"] in ("LineString", "MultiLineString") for f in r), "roads: line geometry")

    for n in ("zones", "stations", "buildings", "roads", "meta"):
        print(f"size {n}: {(out / (n + ('.json' if n == 'meta' else '.geojson'))).stat().st_size:,} bytes")
    print("FAILED" if FAILS else "ALL CHECKS PASSED")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
