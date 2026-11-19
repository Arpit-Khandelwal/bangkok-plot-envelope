"""Fetch a clipped window of the Google Open Buildings 2.5D Temporal height raster (no login, no Earth Engine).

The dataset lives in a public Google Cloud Storage bucket, reachable over plain HTTPS:
    https://storage.googleapis.com/open-buildings-temporal-data/v1/manifests/<s2>_EPSG_<utm>_<year>_06_30.json
    https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/<uriPrefix tail>/<uri>
Each tile is a 25000 x 25000 px, 0.5 m/px, 3-band float32 GeoTIFF (building_fractional_count, building_height,
building_presence; nodata -99), internally tiled, 0.76 to 1.6 GB. We never download a whole tile: GDAL /vsicurl/
range-reads only the study window, which is clipped into a small local GeoTIFF that the sampling step reuses.
"""
import json
import urllib.request
from pathlib import Path

import numpy as np
import pyproj
import rasterio
from rasterio.windows import Window, from_bounds

BUCKET = "open-buildings-temporal-data"
HTTPS = f"https://storage.googleapis.com/{BUCKET}"
LIST_API = f"https://storage.googleapis.com/storage/v1/b/{BUCKET}/o"
UTM_EPSG = 32647
CHUNK_ROWS = 1024
USER_AGENT = {"User-Agent": "bangkok-plot-envelope-pipeline/0.1 (offline data bake)"}


def _get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=USER_AGENT), timeout=120) as r:
        return r.read()


def utm_bounds(bbox, pad_m: float):
    t = pyproj.Transformer.from_crs(4326, UTM_EPSG, always_xy=True)
    x0, y0 = t.transform(bbox[0], bbox[1])
    x1, y1 = t.transform(bbox[2], bbox[3])
    return (min(x0, x1) - pad_m, min(y0, y1) - pad_m, max(x0, x1) + pad_m, max(y0, y1) + pad_m)


def find_tile(bounds, year: int, work: Path) -> dict:
    """Search the per-S2-cell manifests of this UTM zone for a tile that fully contains `bounds`."""
    listing = json.loads(_get(f"{LIST_API}?prefix=v1/manifests/&fields=items(name)&maxResults=1000"))
    names = [i["name"] for i in listing["items"] if f"_EPSG_{UTM_EPSG}_{year}_06_30.json" in i["name"]]
    if not names:
        raise SystemExit(f"no manifest for EPSG:{UTM_EPSG} year {year}")
    x0, y0, x1, y1 = bounds
    for name in names:
        cache = work / "raw" / Path(name).name
        if not cache.exists():
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_bytes(_get(f"{HTTPS}/{name}"))
        man = json.loads(cache.read_text())
        for ts in man["tilesets"]:
            for src in ts["sources"]:
                a, d = src["affineTransform"], src["dimensions"]
                tx0, ty1 = a["translateX"], a["translateY"]
                tx1, ty0 = tx0 + d["width"] * a["scaleX"], ty1 + d["height"] * a["scaleY"]
                if tx0 <= x0 and tx1 >= x1 and ty0 <= y0 and ty1 >= y1:
                    return {"url": f"{HTTPS}/v1/geotiffs/{man['uriPrefix'].rsplit('/', 1)[1]}{src['uris'][0]}",
                            "manifest": man["name"], "imagery": [man["properties"]["imagery_start_time_epoch_s"],
                                                                 man["properties"]["imagery_end_time_epoch_s"]]}
    raise SystemExit("no single tile contains the study window (mosaicking is not implemented)")


def fetch_window(bbox, year: int, work: Path, pad_m: float = 100.0, refresh: bool = False):
    """Clip the height (+ presence) bands for bbox to work/raw/obt_<year>.tif. Returns (path, info)."""
    out = work / "raw" / f"open_buildings_temporal_{year}.tif"
    info_p = out.with_suffix(".json")
    if out.exists() and info_p.exists() and not refresh:
        return out, json.loads(info_p.read_text())
    tile = find_tile(utm_bounds(bbox, pad_m), year, work)
    print("reading", tile["url"])
    with rasterio.open("/vsicurl/" + tile["url"]) as src:
        win = from_bounds(*utm_bounds(bbox, pad_m), transform=src.transform).round_offsets().round_lengths()
        profile = {"driver": "GTiff", "dtype": "float32", "count": 2, "width": int(win.width), "height": int(win.height),
                   "crs": src.crs, "nodata": src.nodata, "compress": "deflate", "tiled": True,
                   "blockxsize": 512, "blockysize": 512,
                   "transform": src.window_transform(win)}
        out.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(out, "w", **profile) as dst:
            for r0 in range(0, int(win.height), CHUNK_ROWS):
                h = min(CHUNK_ROWS, int(win.height) - r0)
                w = Window(win.col_off, win.row_off + r0, win.width, h)
                data = src.read([2, 3], window=w).astype(np.float32)
                dst.write(data, window=Window(0, r0, win.width, h))
            dst.set_band_description(1, "building_height")
            dst.set_band_description(2, "building_presence")
    info = {**tile, "year": year, "pixelSizeM": 0.5, "clippedPx": [int(win.width), int(win.height)]}
    info_p.write_text(json.dumps(info))
    return out, info
