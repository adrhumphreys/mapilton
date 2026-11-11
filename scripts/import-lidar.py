"""Build the local hillshade and building heights from LINZ Hamilton 2023 LiDAR."""

from base64 import b64encode
from contextlib import ExitStack
import json
from pathlib import Path

import numpy as np
from pyproj import Transformer
import rasterio
from rasterio.features import geometry_mask, rasterize
from rasterio.merge import merge
from rasterio.windows import Window
from scipy.ndimage import maximum_filter, minimum_filter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://nz-elevation.s3.ap-southeast-2.amazonaws.com/waikato/hamilton_2023'
TILES = ('BD33_10000_0304', 'BD33_10000_0305', 'BD33_10000_0404', 'BD33_10000_0405')
# Local east/south coordinates match import-osm.py.
WEST, NORTH, EAST, SOUTH, STEP = -2400, -2450, 2560, 2450, 5
TRANSFORM = Transformer.from_crs('EPSG:4326', 'EPSG:2193', always_xy=True)


def nz_grid(x, y):
    return TRANSFORM.transform(175.286 + np.asarray(x) / 87900, -37.792 - np.asarray(y) / 111000)


def read_raster(product, bounds, tiles=TILES):
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', GDAL_HTTP_TIMEOUT='45'), ExitStack() as stack:
        datasets = [stack.enter_context(rasterio.open(f'{SOURCE}/{product}/2193/{tile}.tiff'))
                    for tile in tiles]
        raster, transform = merge(datasets, bounds=bounds, res=1, dtype='float32', nodata=np.nan)
    return raster[0], transform


def hillshade(dem, transform):
    x, y = np.meshgrid(np.arange(WEST, EAST, STEP), np.arange(NORTH, SOUTH, STEP))
    e, n = nz_grid(x, y)
    inv = ~transform
    cols, rows = inv * (e, n)
    z = dem[np.floor(rows).astype(int), np.floor(cols).astype(int)]
    # Central differences over three cells soften returns from narrow channels.
    dy = (z[2:, 1:-1] - z[:-2, 1:-1]) / (2 * STEP)
    dx = (z[1:-1, 2:] - z[1:-1, :-2]) / (2 * STEP)
    light = (0.78 + 0.47 * dx + 0.41 * dy) / np.sqrt(1 + dx * dx + dy * dy)
    relief = np.clip((light - 0.78) * 175, -100, 70)
    shade = np.pad(np.rint(np.nan_to_num(relief)).astype(np.int16) + 128, 1, mode='edge').astype(np.uint8)
    return {'x': WEST, 'y': NORTH, 'step': STEP, 'width': shade.shape[1],
            'height': shade.shape[0], 'shade': b64encode(shade.tobytes()).decode()}


def building_heights(buildings, dem, dsm, transform):
    heights = {}
    seen = set()
    for _, _, _, ring in buildings:
        key = ','.join(format(v, '.10g') for v in (*ring[0], *ring[1], len(ring)))
        if key in seen:
            raise ValueError(f'Duplicate footprint key: {key}')
        seen.add(key)
        x, y = np.array(ring).T
        e, n = nz_grid(x, y)
        cols, rows = (~transform) * (e, n)
        c0, c1 = max(0, int(np.floor(min(cols)))), min(dem.shape[1], int(np.ceil(max(cols))))
        r0, r1 = max(0, int(np.floor(min(rows)))), min(dem.shape[0], int(np.ceil(max(rows))))
        if c1 <= c0 or r1 <= r0:
            continue
        window = Window(c0, r0, c1 - c0, r1 - r0)
        geometry = {'type': 'Polygon', 'coordinates': [list(zip(e, n))]}
        interior = geometry_mask([geometry], out_shape=(r1-r0, c1-c0),
                                 transform=rasterio.windows.transform(window, transform), invert=True)
        difference = (dsm[r0:r1, c0:c1] - dem[r0:r1, c0:c1])[interior]
        valid = difference[np.isfinite(difference)]
        if valid.size < max(7, difference.size * 0.75):
            continue
        lower, upper = np.percentile(valid, [30, 85])
        if 1.8 <= lower <= 95 and upper - lower < 12:
            heights[key] = [round(float(lower), 1), round(float(upper - lower), 1)]
    return heights


def canopy_points(map_data, dem, dsm, transform):
    """Find probable crowns in elevated returns outside mapped structures."""
    def coordinates(ring):
        x, y = np.asarray(ring).T
        return list(zip(*nz_grid(x, y)))

    polygons = [{'type': 'Polygon', 'coordinates': [coordinates(ring)]}
                for _, _, _, ring in map_data['buildings']]
    polygons.extend({'type': 'Polygon', 'coordinates': [coordinates(ring) for ring in rings]}
                    for kind, rings in map_data['areas'] if kind in ('water', 'parking', 'plaza'))
    blocked = rasterize(polygons, out_shape=dem.shape, transform=transform,
                        all_touched=True, dtype='uint8')
    lines = [{'type': 'LineString', 'coordinates': coordinates(line)}
             for kind, bridge, tunnel, line in map_data['roads']
             if not tunnel and kind not in ('path', 'footway', 'cycleway', 'steps')]
    road_cells = rasterize(lines, out_shape=dem.shape, transform=transform, dtype='uint8')
    blocked |= maximum_filter(road_cells, size=5)
    above_ground = dsm - dem
    above_ground[blocked.astype(bool) | ~np.isfinite(above_ground)] = 0
    # Require a contiguous patch to reject isolated poles and roof-edge returns.
    solid = minimum_filter(above_ground, size=3)
    candidates = (solid > 2.5) & (solid < 34) & (solid == maximum_filter(solid, size=5))
    rows, cols = np.nonzero(candidates)
    heights = solid[rows, cols]
    order = np.argsort(-heights, kind='stable')
    occupied = np.zeros(dem.shape, dtype=bool)
    crowns = []
    for i in order:
        row, col = rows[i], cols[i]
        if occupied[row, col]:
            continue
        h = float(heights[i])
        radius = max(3, min(8, round(2 + h * 0.29)))
        occupied[max(0, row-radius):row+radius+1, max(0, col-radius):col+radius+1] = True
        crowns.append((col + 0.5, row + 0.5, h, radius))
    if not crowns:
        raise ValueError('No probable canopy found in the Hamilton survey')
    cols, rows, heights, radii = np.asarray(crowns).T
    e, n = transform * (cols, rows)
    lon, lat = TRANSFORM.transform(e, n, direction='INVERSE')
    return np.round(np.column_stack(((lon - 175.286) * 87900, (-37.792 - lat) * 111000,
                                     heights, radii)), 1).tolist()


def main():
    e, n = nz_grid([WEST, WEST, EAST, EAST], [NORTH, SOUTH, NORTH, SOUTH])
    bounds = (int(min(e))-8, int(min(n))-8, int(max(e))+8, int(max(n))+8)
    dem, transform = read_raster('dem_1m', bounds)
    print('Read bare-earth elevation', flush=True)
    dsm, surface_transform = read_raster('dsm_1m', bounds)
    if dsm.shape != dem.shape or surface_transform != transform:
        raise ValueError('Terrain and surface grids do not match')
    map_data = json.loads((ROOT / 'dist/hamilton.json').read_text())
    buildings = map_data['buildings']
    heights = building_heights(buildings, dem, dsm, transform)
    if len(heights) < len(buildings) * 0.7:
        raise ValueError(f'Only {len(heights)} buildings have usable LiDAR coverage')
    canopy = canopy_points(map_data, dem, dsm, transform)
    result = {'terrain': hillshade(dem, transform), 'buildings': heights, 'canopy': canopy}
    (ROOT / 'dist/hamilton-lidar.json').write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(f'Wrote hillshade and {len(heights)} building estimates and {len(canopy)} probable crowns')


if __name__ == '__main__':
    main()
