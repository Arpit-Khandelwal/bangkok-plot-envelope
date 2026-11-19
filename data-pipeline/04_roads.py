"""Road centrelines for a bbox: Overture segments (geometry, names, class) + OSM tags (lanes, width) joined by OSM way id.

usage: python -I 04_roads.py [--bbox ...] [--release X] [--refresh] [--no-osm]
widthEst is an ESTIMATED right-of-way width (m) to pre-fill a default the user must confirm.
"""
import argparse
import collections
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # python -I drops the script dir

from shapely.geometry import mapping, shape

from common import add_common_args, overpass, r6, resolve_bbox, to_utm, to_wgs, write_json

import importlib.util
_spec = importlib.util.spec_from_file_location("buildings03", Path(__file__).resolve().parent / "03_buildings.py")
_b = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_b)
download, release_of = _b.download, _b.release_of

# Estimated right-of-way (ROW) width table, metres. Not legal ROW: building-line to building-line proxy.
CLASS_DEFAULT_ROW = {"motorway": 30, "trunk": 30, "primary": 24, "secondary": 16, "tertiary": 10,
                     "unclassified": 8, "residential": 6, "living_street": 5, "service": 4}
# ROW = lanes * LANE_M + MARGIN[class]   (margin = shoulders, footpaths, median, verges)
LANE_M = 3.25
LANE_MARGIN = {"motorway": 8, "trunk": 10, "primary": 10, "secondary": 8, "tertiary": 6,
               "unclassified": 4, "residential": 3, "living_street": 2, "service": 2}
# if a `width` tag exists (OSM: usually carriageway width) ROW = width + 2 * FOOTPATH, floored at 0
WIDTH_TAG_SIDE_ALLOWANCE = {"motorway": 4, "trunk": 3, "primary": 3, "secondary": 2.5, "tertiary": 2,
                            "unclassified": 1, "residential": 1, "living_street": 0.5, "service": 0}
DUAL_CARRIAGEWAY = {"motorway", "trunk", "primary", "secondary"}  # one-way ways of these classes are assumed paired
KEEP = set(CLASS_DEFAULT_ROW)
DROP_SUBCLASS = {"sidewalk", "parking_aisle", "driveway"}
HIGHWAY_RE = re.compile(r"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$")


def first_num(v):
    m = re.match(r"^\s*(\d+(?:\.\d+)?)", str(v or ""))
    return float(m.group(1)) if m else None


def width_est(cls, lanes, width_tag, oneway):
    if width_tag:
        return round(width_tag + 2 * WIDTH_TAG_SIDE_ALLOWANCE[cls], 1), "tag"
    if lanes:
        n = lanes * 2 if (oneway and cls in DUAL_CARRIAGEWAY) else lanes
        return round(max(CLASS_DEFAULT_ROW["service"], n * LANE_M + LANE_MARGIN[cls]), 1), "est"
    return float(CLASS_DEFAULT_ROW[cls]), "est"


def main():
    ap = argparse.ArgumentParser()
    add_common_args(ap)
    ap.add_argument("--release", default=None)
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--no-osm", action="store_true", help="skip the Overpass tag join (no lanes)")
    a = ap.parse_args()
    out, work = Path(a.out), Path(a.work)
    bbox = resolve_bbox(a.bbox, work)
    raw = work / "raw" / "overture_segments.geojson"
    download("segment", bbox, a.release, raw, a.refresh)
    segs = json.loads(raw.read_text(encoding="utf-8"))["features"]

    osm = {}
    osm_ok = False
    if not a.no_osm:
        q = (f"[out:json][timeout:180];way[highway]({bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]});out tags;")
        for e in overpass(q, work / "raw" / "osm_highways.json", a.refresh)["elements"]:
            osm[e["id"]] = e.get("tags", {})
        osm_ok = True

    log = collections.Counter()
    feats = []
    for s in segs:
        p = s["properties"]
        if p.get("subtype") != "road" or p.get("class") not in KEEP or p.get("subclass") in DROP_SUBCLASS:
            log["dropped_non_road_or_non_vehicular"] += 1
            continue
        cls = p["class"]
        wid = next((int(x["record_id"][1:].split("@")[0]) for x in p.get("sources", [])
                    if x.get("provider") == "osm" and str(x.get("record_id", "")).startswith("w")), None)
        t = osm.get(wid, {})
        if wid and osm_ok and not t:
            log["osm_way_not_found"] += 1
        names = p.get("names") or {}
        common = {k: v for k, v in (names.get("common") or [])}
        name_en = common.get("en") or t.get("name:en") or ""
        name_th = common.get("th") or t.get("name:th") or ""
        prim = names.get("primary") or t.get("name") or ""
        if not name_th and re.search(r"[฀-๿]", prim):
            name_th = prim
        if not name_en and prim and not re.search(r"[฀-๿]", prim):
            name_en = prim
        lanes = first_num(t.get("lanes"))
        width_tag = first_num(t.get("width"))
        if width_tag is None:
            ov = [r["value"] for r in (p.get("width_rules") or []) if r.get("between") is None and r.get("value")]
            width_tag = float(ov[0]) if ov else None
        oneway = t.get("oneway") in ("yes", "1", "true")
        w, wsrc = width_est(cls, int(lanes) if lanes else None, width_tag, oneway)
        log["widthSrc_" + wsrc] += 1
        props = {"class": cls, "widthEst": w, "widthSrc": wsrc}
        if name_en or name_th:
            props["name"] = name_en or name_th
        if name_th:
            props["nameTh"] = name_th
        if lanes:
            props["lanes"] = int(lanes)
        if oneway:
            props["oneway"] = True
        ug = to_utm(shape(s["geometry"])).simplify(0.5)
        feats.append({"type": "Feature", "properties": props, "geometry": r6(mapping(to_wgs(ug)))})
        log["class_" + cls] += 1

    nbytes = write_json(out / "roads.geojson", {"type": "FeatureCollection", "features": feats})
    summary = {"bbox": bbox, "release": release_of(raw), "count": len(feats), "bytes": nbytes, "osm_tag_join": osm_ok,
               "log": dict(log), "widthEst_table": {"class_default_row_m": CLASS_DEFAULT_ROW, "lane_m": LANE_M,
                                                     "lane_margin_m": LANE_MARGIN,
                                                     "width_tag_side_allowance_m": WIDTH_TAG_SIDE_ALLOWANCE}}
    write_json(work / "roads_summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
