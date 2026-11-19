"""Bake mass-transit stations (+ platform geometry) for Bangkok from OSM/Overpass.

usage: python -I 02_stations.py [--refresh] [--out DIR] [--work DIR]
Always covers config.bangkokBounds (all of Bangkok + Samut Prakan/Nonthaburi fringe), not the study bbox.
"""
import argparse
import collections
import datetime
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # python -I drops the script dir

from shapely import make_valid
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon, mapping
from shapely.geometry.polygon import orient
from shapely.ops import polygonize, unary_union

from common import CONFIG, add_common_args, now_iso, overpass, r6, to_utm, write_json

PLATFORM_ASSIGN_M = 150      # platform must be within this distance (m) of a station node
MERGE_SAME_REF_M = 150       # node duplicates with same ref+name merge within this distance
MERGE_SAME_NAME_M = 40       # ...or same name with no ref
RAIL_MODE_RE = r"^(train|subway|light_rail|monorail)$"

# line from ref prefix (first matching token of a ';'-separated ref)
LINES = [
    (r"^BL\d+", "MRT Blue Line", "MRT"), (r"^PP\d+", "MRT Purple Line", "MRT"),
    (r"^PK\d+", "MRT Pink Line", "MRT"), (r"^YL\d+", "MRT Yellow Line", "MRT"),
    (r"^A\d+$", "Airport Rail Link", "ARL"), (r"^R[NSWE]\d+", "SRT Red Line", "SRT"),
    (r"^G\d+$", "BTS Gold Line", "BTS"), (r"^CEN$", "BTS Sukhumvit/Silom Line", "BTS"),
    (r"^[NE]\d+$", "BTS Sukhumvit Line", "BTS"), (r"^[SW]\d+$", "BTS Silom Line", "BTS"),
]
# OSM ids whose ref is missing/Thai-only in OSM but which are mass-transit stations (documented override)
OVERRIDES = {8986366369: ("SRT Red Line", "SRT", "RN01/RW01 (Krung Thep Aphiwat Central Terminal)")}
STATUS_KEYS = ("construction", "construction:railway", "proposed", "proposed:railway", "planned",
               "disused", "disused:railway", "abandoned", "abandoned:railway", "razed:railway")


def q_stations(b):
    bb = f"({b[1]},{b[0]},{b[3]},{b[2]})"
    # nodes also pull railway=construction/proposed so we can COUNT what we exclude; ways/relations only station-like tags
    node_f = ("[railway~'^(station|halt|construction|proposed)$']",
              "[public_transport=station][~'^(train|subway|light_rail|monorail)$'~'^yes$']",
              "['construction:railway'~'^(station|halt)$']", "['proposed:railway'~'^(station|halt)$']")
    area_f = ("[railway~'^(station|halt)$']",
              "[public_transport=station][~'^(train|subway|light_rail|monorail)$'~'^yes$']",
              "['construction:railway'~'^(station|halt)$']", "['proposed:railway'~'^(station|halt)$']")
    body = "".join(f"node{s}{bb};" for s in node_f) + "".join(f"{t}{s}{bb};" for t in ("way", "relation") for s in area_f)
    return "[out:json][timeout:240];(" + body + ");out tags center;"


def q_platforms(b):
    bb = f"({b[1]},{b[0]},{b[3]},{b[2]})"
    return ("[out:json][timeout:240];(" + "".join(f"{t}{s}{bb};" for t in ("way", "relation") for s in (
        "[railway=platform]",
        f"[public_transport=platform][~'^(train|subway|light_rail|monorail)$'~'^yes$']",
    )) + ");out tags geom;")


def exclusion_reason(t, today):
    if t.get("railway") in ("construction", "proposed"):
        return f"railway={t['railway']}"
    for k in STATUS_KEYS:
        if k in t:
            return k
    for k in ("opening_date", "start_date"):
        v = t.get(k, "")
        m = re.match(r"^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?", v)
        if m:
            y, mo, d = int(m[1]), int(m[2] or 12), int(m[3] or 28)
            if datetime.date(y, mo, d) > today:
                return f"{k}={v} is in the future"
    return None


def classify(t, osm_id):
    """-> (line, network, via) for a mass-transit station or None."""
    if osm_id in OVERRIDES:
        l, n, v = OVERRIDES[osm_id]
        return l, n, "override:" + v
    for tok in re.split(r"[;,]\s*", t.get("ref", "")):
        for rx, line, net in LINES:
            if re.match(rx, tok.strip()):
                return line, net, "ref:" + tok.strip()
    net = (t.get("network") or "")
    if "สายสีแดง" in net:
        return "SRT Red Line", "SRT", "network"
    if net == "ARL":
        return "Airport Rail Link", "ARL", "network"
    return None


def ring_geoms(el):
    pts = [(g["lon"], g["lat"]) for g in el.get("geometry", []) if g]
    return pts


def platform_geom(el):
    """Platform element -> shapely polygon/line (or None)."""
    if el["type"] == "way":
        pts = ring_geoms(el)
        if len(pts) >= 4 and pts[0] == pts[-1]:
            g = Polygon(pts)
            g = g if g.is_valid else make_valid(g)
            polys = [p for p in getattr(g, "geoms", [g]) if isinstance(p, Polygon) and not p.is_empty]
            return unary_union(polys) if polys else None
        return LineString(pts) if len(pts) >= 2 else None
    lines = [LineString(ring_geoms(m)) for m in el.get("members", []) if m.get("geometry") and len(m["geometry"]) >= 2]
    polys = list(polygonize(unary_union(lines))) if lines else []
    return unary_union(polys) if polys else (unary_union(lines) if lines else None)


def main():
    ap = argparse.ArgumentParser()
    add_common_args(ap)
    ap.add_argument("--refresh", action="store_true", help="re-download from Overpass")
    a = ap.parse_args()
    out, work = Path(a.out), Path(a.work)
    b = CONFIG["bangkokBounds"]
    today = datetime.date.today()
    st = overpass(q_stations(b), work / "osm_stations.json", a.refresh)
    pl = overpass(q_platforms(b), work / "osm_platforms.json", a.refresh)
    log = collections.Counter()

    # ---- candidate stations
    cands = []
    for e in st["elements"]:
        t = e.get("tags", {})
        c = (e["lon"], e["lat"]) if e["type"] == "node" else (e["center"]["lon"], e["center"]["lat"])
        why = exclusion_reason(t, today)
        if why:
            log["excluded_not_operational:" + why.split("=")[0]] += 1
            continue
        cl = classify(t, e["id"])
        if not cl:
            log["excluded_not_mass_transit(SRT intercity / airport APM / MT monorail / other)"] += 1
            continue
        cands.append({"osmType": e["type"], "osmId": e["id"], "c": c, "t": t, "line": cl[0], "net": cl[1], "via": cl[2]})
    log["operational_mass_transit_candidates"] = len(cands)

    # ---- merge duplicates (node + way/relation mapping of same station, or twin nodes)
    cands.sort(key=lambda x: (x["osmType"] != "node", x["osmId"]))
    merged = []
    for s in cands:
        sp = to_utm(Point(*s["c"]))
        nm = s["t"].get("name:en") or s["t"].get("name", "")
        ref = s["t"].get("ref", "")
        dup = None
        for m in merged:
            if m["line"] != s["line"] or m["name"] != nm:
                continue
            d = sp.distance(m["p"])
            if (ref and m["ref"] == ref and d < MERGE_SAME_REF_M) or (not ref and d < MERGE_SAME_NAME_M) or d < 15:
                dup = m
                break
        if dup:
            dup["dups"].append(s["osmId"])
            log["merged_duplicates"] += 1
            continue
        merged.append({**s, "p": sp, "name": nm, "ref": ref, "dups": []})
    log["stations_after_merge"] = len(merged)

    # ---- platforms
    plats = []
    for e in pl["elements"]:
        g = platform_geom(e)
        if g is None or g.is_empty:
            log["platform_unusable"] += 1
            continue
        plats.append((e, g, to_utm(g)))
    assigned = collections.defaultdict(list)
    for e, g, ug in plats:
        best, bd = None, 1e9
        for m in merged:
            d = ug.distance(m["p"])
            if d < bd:
                best, bd = m, d
        if best is not None and bd <= PLATFORM_ASSIGN_M:
            assigned[id(best)].append((e, g, bd))
        else:
            log["platform_unassigned"] += 1

    feats = []
    for i, m in enumerate(sorted(merged, key=lambda x: (x["line"], x["ref"], x["name"]))):
        t = m["t"]
        pls = assigned.get(id(m), [])
        polys = [g for _, g, _ in pls if isinstance(g, (Polygon, MultiPolygon))]
        lines = [g for _, g, _ in pls if isinstance(g, (LineString, MultiLineString))]
        props = {"id": i, "name": m["name"] or t.get("name", ""), "nameTh": t.get("name:th") or t.get("name", ""),
                 "ref": m["ref"], "line": m["line"], "network": m["net"],
                 "operator": t.get("operator:en") or t.get("operator", ""),
                 "osmId": f'{m["osmType"]}/{m["osmId"]}', "classifiedVia": m["via"]}
        if polys:
            geom = unary_union(polys)
            geom = MultiPolygon([orient(p, 1.0) for p in (geom.geoms if hasattr(geom, "geoms") else [geom])])
            props.update(geomSource="platform", platformGeom="polygon", platformCount=len(polys),
                         platformOsmIds=[f'{e["type"]}/{e["id"]}' for e, g, _ in pls if isinstance(g, (Polygon, MultiPolygon))])
            log["geom_platform_polygon"] += 1
        elif lines:
            geom = unary_union(lines)
            geom = geom if isinstance(geom, MultiLineString) else MultiLineString(list(getattr(geom, "geoms", [geom])))
            props.update(geomSource="platform", platformGeom="line", platformCount=len(lines),
                         platformOsmIds=[f'{e["type"]}/{e["id"]}' for e, g, _ in pls])
            log["geom_platform_line"] += 1
        else:
            geom = Point(*m["c"])
            props.update(geomSource="node", platformCount=0)
            log["geom_node"] += 1
        if polys and lines:
            log["stations_with_dropped_line_platforms"] += 1
        props["nodeLon"], props["nodeLat"] = round(m["c"][0], 6), round(m["c"][1], 6)
        feats.append({"type": "Feature", "id": i, "properties": props, "geometry": r6(mapping(geom))})

    fc = {"type": "FeatureCollection", "features": feats}
    nbytes = write_json(out / "stations.geojson", fc)
    summary = {"bytes": nbytes, "count": len(feats), "log": dict(log),
               "by_line": dict(collections.Counter(f["properties"]["line"] for f in feats)),
               "by_geomSource": dict(collections.Counter(f["properties"]["geomSource"] for f in feats)),
               "osm_timestamps": {"stations": st.get("osm3s", {}).get("timestamp_osm_base"),
                                  "platforms": pl.get("osm3s", {}).get("timestamp_osm_base")}}
    write_json(work / "stations_summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    for f in feats:
        if f["properties"]["ref"] in ("E10", "E11"):
            p = f["properties"]
            print(p["ref"], p["name"], p["geomSource"], p.get("platformGeom"), p["platformCount"], f["geometry"]["type"])


if __name__ == "__main__":
    main()
