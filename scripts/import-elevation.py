"""Sample the full Hamilton terrain in the map's orthographic ground coordinates."""

from base64 import b64encode
import json
from pathlib import Path
from runpy import run_path

import numpy as np
from rasterio.features import rasterize
from rasterio.transform import Affine
from scipy.ndimage import binary_erosion, distance_transform_edt, gaussian_filter, label

ROOT = Path(__file__).resolve().parents[1]
lidar = run_path(str(ROOT / 'scripts/import-lidar.py'))
WIDTH, HEIGHT, STEP = 3660, 2360, 2
ANGLE, PITCH = np.pi / 9, 0.68
COS, SIN = np.cos(ANGLE), np.sin(ANGLE)


def main():
    x, y = np.meshgrid(np.arange(0, WIDTH + STEP, STEP), np.arange(0, HEIGHT + STEP, STEP))
    across, depth = x - 1290, (y - 1105) / PITCH
    east, north = lidar['nz_grid'](COS * across - SIN * depth, SIN * across + COS * depth)
    bounds = (int(east.min()) - 4, int(north.min()) - 4,
              int(east.max()) + 4, int(north.max()) + 4)
    dem, transform = lidar['read_raster']('dem_1m', bounds,
                                        (*lidar['TILES'], 'BD34_10000_0301', 'BD34_10000_0401'))
    cols, rows = (~transform) * (east, north)
    samples = dem[rows.astype(int), cols.astype(int)]
    measured = np.isfinite(samples)
    coverage = float(measured.mean())
    if coverage < 0.98:
        raise ValueError(f'Insufficient elevation coverage: {coverage:.2%}')
    if not measured.all():
        distance, nearest = distance_transform_edt(~measured, return_indices=True)
        if distance.max() * STEP > 75:
            raise ValueError('Unmeasured terrain extends too far from the survey')
        samples = samples[tuple(nearest)]
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
                     transform=Affine.translation(-STEP / 2, -STEP / 2) * Affine.scale(STEP)).astype(bool)
    basins, count = label(mask)
    interiors = binary_erosion(mask, iterations=2)
    # Separate the lake, river and ponds so they each use their surveyed water level.
    for basin in range(1, count + 1):
        surface = basins == basin
        core = surface & interiors
        samples[surface] = np.median(samples[core if core.any() else surface])
    reference = 35
    encoded = np.rint((samples - reference) * 10).astype('<i2')
    result = {'left': 0, 'top': 0, 'width': x.shape[1], 'height': x.shape[0],
              'step': STEP, 'reference': reference, 'coverage': round(coverage, 5),
              'decimetres': b64encode(encoded.tobytes()).decode()}
    (ROOT / 'dist/hamilton-elevation.json').write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(f'Elevation range: {samples.min():.1f}–{samples.max():.1f} m; measured coverage {coverage:.2%}; {count} water surfaces')


if __name__ == '__main__':
    main()
