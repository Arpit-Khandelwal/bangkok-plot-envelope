"""Write public/data/meta.json from the other steps' work summaries.  usage: python -I 05_meta.py"""
import argparse
import collections
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # python -I drops the script dir

from common import CONFIG, add_common_args, load_study, now_iso, write_json


def licenses(raw: Path):
    c = collections.defaultdict(set)
    for f in json.loads(raw.read_text(encoding="utf-8"))["features"]:
        for s in f["properties"].get("sources", []):
            c[s.get("dataset")].add(s.get("license"))
    return {k: sorted(x for x in v if x) for k, v in c.items()}


def main():
    ap = argparse.ArgumentParser()
    add_common_args(ap)
    a = ap.parse_args()
    out, work = Path(a.out), Path(a.work)
    study = load_study(work)
    S = {k: json.loads((work / f"{k}_summary.json").read_text(encoding="utf-8"))
         for k in ("zones", "stations", "buildings", "roads")}
    meta = {
        "generatedAt": now_iso(),
        "study": {"zoneId": study["zoneId"], "zone": study["zone"], "zoneAreaM2": study["zoneAreaM2"],
                  "zoneBounds": study["zoneBounds"], "marginMetres": study["marginMetres"],
                  "bbox": study["bbox"], "bboxOrder": "minLon,minLat,maxLon,maxLat (WGS84)",
                  "description": "Bounds of the Bangkok Comprehensive Plan 2556 zone ย.7 polygon containing BTS Bang Chak (E10) "
                                 "and Punnawithi (E11), plus a 600 m margin. buildings.geojson and roads.geojson cover this bbox only."},
        "files": {
            "zones.geojson": {"features": S["zones"]["features_after"], "bytes": S["zones"]["bytes"], "planVersion": CONFIG["planVersion"]},
            "stations.geojson": {"features": S["stations"]["count"], "bytes": S["stations"]["bytes"],
                                 "byGeomSource": S["stations"]["by_geomSource"]},
            "buildings.geojson": {"features": S["buildings"]["count"], "bytes": S["buildings"]["bytes"],
                                  "hSrcPercent": S["buildings"]["hSrc_pct"], "heightHeuristic": S["buildings"]["heuristic"]},
            "roads.geojson": {"features": S["roads"]["count"], "bytes": S["roads"]["bytes"],
                              "widthEstimateTable": S["roads"]["widthEst_table"],
                              "note": "widthEst is an ESTIMATED right-of-way width; pre-fill only, user must confirm."},
        },
        "sources": {
            "zoning": {"name": "Bangkok Comprehensive Plan B.E. 2556 (2013), land-use zones, via third-party GeoJSON "
                               "Kanesuan/KNS.MAP (public/data/bkk-zoning-current.geojson, derived from the BMA City Planning "
                               "Department ArcGIS service)",
                       "licence": "unverified: no licence stated by BMA or the derived dataset; treat as indicative, non-commercial",
                       "version": "plan B.E. 2556"},
            "stations": {"name": "OpenStreetMap via Overpass API", "licence": "ODbL-1.0",
                         "osmBaseTimestamps": S["stations"]["osm_timestamps"]},
            "buildings": {"name": "Overture Maps Foundation, buildings theme (building)", "release": S["buildings"]["release"],
                          "datasetsInBBox": S["buildings"]["sources"],
                          "licencesBySourceDataset": licenses(work / "raw" / "overture_buildings.geojson")},
            "roads": {"name": "Overture Maps Foundation transportation theme (segment) + OpenStreetMap tags (lanes, width) via Overpass",
                      "release": S["roads"]["release"], "osmTagJoin": S["roads"]["osm_tag_join"],
                      "licencesBySourceDataset": licenses(work / "raw" / "overture_segments.geojson")},
        },
        "attribution": [
            "© OpenStreetMap contributors (ODbL 1.0, https://www.openstreetmap.org/copyright)",
            "Building data © Overture Maps Foundation (https://overturemaps.org), including OpenStreetMap, Google Open Buildings and Microsoft ML Buildings; ODbL 1.0 / CDLA-Permissive-2.0 per source dataset",
            "Road data © Overture Maps Foundation, © OpenStreetMap contributors, includes TomTom data (CDLA-Permissive-2.0)",
            "Zoning: Bangkok Metropolitan Administration, City Planning Department, Comprehensive Plan B.E. 2556 (indicative; third-party derived)",
        ],
        "licenceNotes": "OSM-derived layers (stations, parts of buildings/roads) are ODbL: keep the attribution and share-alike on the derived database. "
                        "Check licencesBySourceDataset before redistributing.",
    }
    nb = write_json(out / "meta.json", meta)
    print("meta.json", nb, "bytes")


if __name__ == "__main__":
    main()
