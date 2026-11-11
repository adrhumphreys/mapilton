"""Sample the Hamilton East terrain in the map's orthographic ground coordinates."""

from base64 import b64encode
import json
from pathlib import Path
from runpy import run_path

import numpy as np
from rasterio.features import rasterize
from rasterio.transform import Affine
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parents[1]
lidar = run_path(str(ROOT / 'scripts/import-lidar.py'))
LEFT, TOP, WIDTH, HEIGHT, STEP = 1420, 690, 1040, 810, 2
ANGLE, PITCH = np.pi / 9, 0.68
COS, SIN = np.cos(ANGLE), np.sin(ANGLE)


def main():
    x, y = np.meshgrid(np.arange(LEFT, LEFT + WIDTH + STEP, STEP),
                       np.arange(TOP, TOP + HEIGHT + STEP, STEP))
    across, depth = x - 1290, (y - 1105) / PITCH
    east, north = lidar['nz_grid'](COS * across - SIN * depth, SIN * across + COS * depth)
    bounds = (int(east.min()) - 4, int(north.min()) - 4,
              int(east.max()) + 4, int(north.max()) + 4)
    dem, transform = lidar['read_raster']('dem_1m', bounds)
    cols, rows = (~transform) * (east, north)
    samples = dem[rows.astype(int), cols.astype(int)]
    if not np.isfinite(samples).all():
        raise ValueError('Incomplete elevation coverage in the Hamilton East pilot')
    samples = gaussian_filter(samples, sigma=0.7)
    water = []
    data = json.loads((ROOT / 'dist/hamilton.json').read_text())
    for kind, rings in data['areas']:
        if kind != 'water':
            continue
        coordinates = []
        for ring in rings:
            ex, sy = np.asarray(ring).T
            coordinates.append(list(zip(1290 + COS * ex + SIN * sy,
                                        1105 + PITCH * (COS * sy - SIN * ex))))
        water.append({'type': 'Polygon', 'coordinates': coordinates})
    mask = rasterize(water, out_shape=samples.shape,
                     transform=Affine.translation(LEFT - STEP / 2, TOP - STEP / 2) * Affine.scale(STEP)).astype(bool)
    water_level = round(float(np.median(samples[mask])), 2)
    samples[mask] = water_level
    reference = 35
    encoded = np.rint((samples - reference) * 10).astype('<i2')
    result = {'left': LEFT, 'top': TOP, 'width': x.shape[1], 'height': x.shape[0],
              'step': STEP, 'reference': reference, 'waterLevel': water_level,
              'decimetres': b64encode(encoded.tobytes()).decode()}
    (ROOT / 'dist/hamilton-elevation.json').write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(f'Pilot elevation range: {samples.min():.1f}–{samples.max():.1f} m; water {water_level:.1f} m')


if __name__ == '__main__':
    main()
