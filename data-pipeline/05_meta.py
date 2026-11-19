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
         for k in ("zones", "stations", "buildings", "roads", "sat", "package")}
    index = json.loads((out / "buildings" / "index.json").read_text(encoding="utf-8"))
    sat = S["sat"]
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
            "buildings.geojson": {"features": sat["count"], "bytes": sat["bytes"], "gitIgnored": True,
                                  "note": "intermediate; the app should load buildings/index.json and its parts",
                                  "hSrcPercent": sat["hSrcPercent"], "heightHeuristic": S["buildings"]["heuristic"]},
            "roads.geojson": {"features": S["roads"]["count"], "bytes": S["roads"]["bytes"],
                              "widthEstimateTable": S["roads"]["widthEst_table"],
                              "note": "widthEst is an ESTIMATED right-of-way width; pre-fill only, user must confirm."},
        },
        "buildings": {
            "index": "buildings/index.json",
            "parts": len(index["parts"]), "total": index["total"],
            "partBytesRange": [S["package"]["minBytes"], S["package"]["maxBytes"]],
            "maxPartBytesAllowed": 900000,
            "hSrcPercent": index["hSrcPercent"],
            "hSrcMeaning": {"height": "explicit Overture/OSM height", "levels": "level count x 3.2 m",
                            "sat": "measured: Google Open Buildings 2.5D Temporal %d, %s of the footprint's non-zero pixels"
                                   % (sat["raster"]["year"], sat["statistic"]),
                            "est": "footprint-area/class heuristic (only where the raster has no building pixel)"},
            "heightSource": {"dataset": "Google Open Buildings 2.5D Temporal v1 (GOOGLE/Research/open-buildings-temporal/v1)",
                             "year": sat["raster"]["year"], "tile": sat["raster"]["url"], "pixelSizeM": 0.5, "effectiveResolutionM": 4,
                             "band": "building_height (m above terrain, 0 to 100, capped at 100)",
                             "statistic": sat["statistic"], "floorM": sat["floorM"],
                             "buildingsTouchingCap": sat["satBuildingsTouchingCap"],
                             "buildingsWithValueAtLeast99m": sat["satBuildingsWithValueAtLeast99"]},
            "heightEvaluation": sat["evaluation"] | {
                "statisticComparison": sat["statisticComparison"],
                "statisticSplitHalfMeanAbsErrorM": sat["statisticSplitHalfMeanAbsErrorM"],
                "limits": ["n=%d (%d with a satellite value); %d are level counts x 3.2 m, only %d are explicit heights" % (
                    sat["evaluation"]["truthN"], sat["evaluation"]["truthWithSatValue"],
                    sat["hSrcCounts"]["levels"], sat["hSrcCounts"]["height"]),
                           "ground truth is biased toward notable OSM-mapped buildings: 114 of 192 are 10 to 23 m, 67 are shophouse "
                           "terraces mapped at 4 levels, and the over-60 m band is 27 mapped towers",
                           "level count x 3.2 m is itself an approximation (true floor-to-floor heights vary roughly 2.8 to 4 m)",
                           "year mismatch: raster is mid-2023 (imagery 2023-01 to 2023-12), ground truth is the Overture 2026-11-18 release",
                           "the heuristic is calibrated on these same 192 buildings; its out-of-fold row uses 5-fold CV but terrace rows "
                           "make the folds near-duplicates, so it is flattered on the 10 to 23 m band",
                           "the statistic was chosen among 8 candidates on the same 192 points (small optimism); split-half MAE shown",
                           "nothing here measures accuracy on the unmapped 99% (mostly low-rise); no ground truth exists for them"]},
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
                          "heights": {"name": "Google Open Buildings 2.5D Temporal (Google Research), building_height band, %d" % sat["raster"]["year"],
                                      "licence": "CC-BY-4.0 or ODbL-1.0 (user's choice, per Google); leverages Copernicus Sentinel-2 data",
                                      "url": "https://sites.research.google/gr/open-buildings/temporal/",
                                      "accessedWithoutLogin": True},
                          "licencesBySourceDataset": licenses(work / "raw" / "overture_buildings.geojson")},
            "roads": {"name": "Overture Maps Foundation transportation theme (segment) + OpenStreetMap tags (lanes, width) via Overpass",
                      "release": S["roads"]["release"], "osmTagJoin": S["roads"]["osm_tag_join"],
                      "licencesBySourceDataset": licenses(work / "raw" / "overture_segments.geojson")},
        },
        "attribution": [
            "© OpenStreetMap contributors (ODbL 1.0, https://www.openstreetmap.org/copyright)",
            "Building data © Overture Maps Foundation (https://overturemaps.org), including OpenStreetMap, Google Open Buildings and Microsoft ML Buildings; ODbL 1.0 / CDLA-Permissive-2.0 per source dataset",
            "Building heights: Google Open Buildings 2.5D Temporal (Google Research, CC BY 4.0 / ODbL 1.0), leverages Copernicus Sentinel-2 data. Sirko et al., High-Resolution Building and Road Detection from Sentinel-2 (2023), https://arxiv.org/abs/2310.11622",
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
