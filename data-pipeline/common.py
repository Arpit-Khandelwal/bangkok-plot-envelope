"""Shared helpers for the data pipeline. Run all scripts with `python -I`."""
import json
import math
import os
from pathlib import Path

import pyproj
from shapely import transform as shp_transform
from shapely.geometry import box, mapping

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
CONFIG = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
DEFAULT_OUT = PROJECT / "public" / "data"
DEFAULT_WORK = HERE / ".work"

_TO_UTM = pyproj.Transformer.from_crs(4326, 32647, always_xy=True)
_TO_WGS = pyproj.Transformer.from_crs(32647, 4326, always_xy=True)


def to_utm(geom):
    """WGS84 lon/lat geometry -> UTM 47N metres."""
    return shp_transform(geom, lambda a: _stack(_TO_UTM.transform(a[:, 0], a[:, 1])))


def to_wgs(geom):
    return shp_transform(geom, lambda a: _stack(_TO_WGS.transform(a[:, 0], a[:, 1])))


def _stack(xy):
    import numpy as np
    return np.column_stack(xy)


def r6(geom_dict):
    """Round every coordinate of a GeoJSON geometry dict to 6 decimals."""
    def rec(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], 6), round(c[1], 6)]
        return [rec(x) for x in c]
    return {"type": geom_dict["type"], "coordinates": rec(geom_dict["coordinates"])}


def load_study(work: Path):
    return json.loads((Path(work) / "study.json").read_text(encoding="utf-8"))


def resolve_bbox(args_bbox, work: Path):
    """--bbox minLon,minLat,maxLon,maxLat or fall back to the baked study bbox."""
    if args_bbox:
        v = [float(x) for x in args_bbox.split(",")]
        assert len(v) == 4
        return v
    return load_study(work)["bbox"]


def add_common_args(ap):
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="public data dir")
    ap.add_argument("--work", default=os.environ.get("PIPELINE_WORK", str(DEFAULT_WORK)),
                    help="scratch dir for large downloads / intermediates")
    ap.add_argument("--bbox", default=None, help="minLon,minLat,maxLon,maxLat (default: study bbox)")


def write_json(path, obj):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return Path(path).stat().st_size


def now_iso():
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def overpass(query: str, cache: Path, refresh=False, timeout=200):
    """POST an Overpass QL query (with User-Agent; overpass-api.de returns 406 without one).
    Caches the raw JSON in `cache`. Tries each configured endpoint in turn."""
    import time
    import urllib.error
    import urllib.parse
    import urllib.request
    cache = Path(cache)
    if cache.exists() and not refresh:
        return json.loads(cache.read_text(encoding="utf-8"))
    cache.parent.mkdir(parents=True, exist_ok=True)
    data = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for attempt in range(3):
        for ep in CONFIG["overpassEndpoints"]:
            try:
                req = urllib.request.Request(ep, data=data, headers={"User-Agent": CONFIG["userAgent"]})
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    body = r.read()
                obj = json.loads(body)
                if "remark" in obj and "runtime error" in obj["remark"]:
                    raise RuntimeError(obj["remark"])
                cache.write_bytes(body)
                return obj
            except (urllib.error.URLError, RuntimeError, TimeoutError, json.JSONDecodeError) as e:
                last = e
                print(f"overpass {ep} failed: {e}")
        time.sleep(10 * (attempt + 1))
    raise SystemExit(f"all Overpass endpoints failed: {last}")
