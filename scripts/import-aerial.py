"""Build the Hamilton East comparison from the LINZ 2024–2025 orthophotos."""

import json
from pathlib import Path

import numpy as np
from pyproj import Transformer
import rasterio
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.transform import Affine
from scipy.ndimage import distance_transform_edt, gaussian_filter

ROOT = Path(__file__).resolve().parents[1] / 'dist'
SOURCE = 'https://nz-imagery.s3.ap-southeast-2.amazonaws.com/waikato/hamilton_2024-2025_0.05m/rgb/2193'
LEFT, TOP, WIDTH, HEIGHT = 1450, 680, 950, 760
# Match the orthographic ground plane in city.js.
ANGLE, PITCH = np.pi / 9, 0.68
ORIGIN_X, ORIGIN_Y = 1290, 1105


def screen(x, y):
    return (ORIGIN_X + np.cos(ANGLE) * x + np.sin(ANGLE) * y,
            ORIGIN_Y + PITCH * (np.cos(ANGLE) * y - np.sin(ANGLE) * x))


def load_aerial():
    x, y = np.meshgrid(np.arange(WIDTH) + LEFT + 0.5, np.arange(HEIGHT) + TOP + 0.5)
    across, depth = x - ORIGIN_X, (y - ORIGIN_Y) / PITCH
    east = np.cos(ANGLE) * across - np.sin(ANGLE) * depth
    south = np.sin(ANGLE) * across + np.cos(ANGLE) * depth
    transformer = Transformer.from_crs(4326, 2193, always_xy=True)
    e, n = transformer.transform(175.286 + east / 87900, -37.792 - south / 111000)
    columns = np.floor((e - 1789600) / 480).astype(int)
    rows = np.floor((5832240 - n) / 720).astype(int)
    photo = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    valid = np.zeros((HEIGHT, WIDTH), dtype=bool)
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', GDAL_HTTP_TIMEOUT='45'):
        for row, col in np.unique(np.column_stack((rows.ravel(), columns.ravel())), axis=0):
            tile = f'BD33_1000_{row + 9:02}{col + 21:02}'
            print(tile, flush=True)
            mask = (columns == col) & (rows == row)
            with rasterio.open(f'{SOURCE}/{tile}.tiff') as source:
                sample = source.read([1, 2, 3, 4], out_shape=(4, 1440, 960),
                                     resampling=Resampling.average)
                inverse = ~(source.transform * Affine.scale(source.width / 960, source.height / 1440))
                sx, sy = inverse * (e[mask], n[mask])
                sx = np.clip(sx.astype(int), 0, 959)
                sy = np.clip(sy.astype(int), 0, 1439)
                photo[mask] = sample[:3, sy, sx].T
                valid[mask] = sample[3, sy, sx] > 200
    if valid.mean() < 0.98:
        raise ValueError(f'Insufficient imagery coverage: {valid.mean():.1%}')
    return photo, valid


def footprints(photo, valid):
    buildings = json.loads((ROOT / 'hamilton.json').read_text())['buildings']
    geometry = []
    keys = []
    for _, _, _, ring in buildings:
        x, y = screen(*np.asarray(ring).T)
        if min(x) >= LEFT + WIDTH or max(x) <= LEFT or min(y) >= TOP + HEIGHT or max(y) <= TOP:
            continue
        geometry.append(({'type': 'Polygon', 'coordinates': [list(zip(x - LEFT, y - TOP))]}, len(keys) + 1))
        keys.append(','.join(format(v, '.10g') for v in (*ring[0], *ring[1], len(ring))))
    ids = rasterize(geometry, out_shape=valid.shape, dtype='int32')
    roofs = {}
    for index, key in enumerate(keys, 1):
        pixels = photo[(ids == index) & valid]
        if len(pixels) < 10:
            continue
        # Exclude the darkest pixels, which commonly contain roof and tree shadows.
        lit = pixels[pixels.mean(axis=1) >= np.percentile(pixels.mean(axis=1), 35)]
        roof = np.median(lit, axis=0).astype(int)
        roofs[key] = '#' + ''.join(f'{channel:02x}' for channel in roof)
    return ids, roofs


def main():
    photo, valid = load_aerial()
    ids, roofs = footprints(photo, valid)
    # Soften fine photographic noise and quantise colour to suit the pixel artwork.
    softened = gaussian_filter(photo.astype(np.float32), sigma=(0.7, 0.7, 0))
    colour = np.clip(np.rint((softened * 0.78 + [43, 44, 35]) / 9) * 9, 0, 255).astype(np.uint8)
    yy, xx = np.indices(valid.shape)
    border = np.minimum.reduce([xx, WIDTH - 1 - xx, yy, HEIGHT - 1 - yy])
    distance = distance_transform_edt(ids == 0)
    opacity = np.minimum(border / 42, 1) * np.clip((distance - 1) / 2, 0, 1) * valid * 174
    rgba = np.dstack((colour, opacity.astype(np.uint8)))
    with rasterio.open(ROOT / 'hamilton-east-ground.png', 'w', driver='PNG',
                       width=WIDTH, height=HEIGHT, count=4, dtype='uint8') as output:
        output.write(np.moveaxis(rgba, -1, 0))
    (ROOT / 'hamilton-east-aerial.json').write_text(json.dumps(
        {'left': LEFT, 'top': TOP, 'roofs': roofs}, separators=(',', ':')) + '\n')
    print(f'Sampled {len(roofs)} roof colours')


if __name__ == '__main__':
    main()
