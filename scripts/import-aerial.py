"""Build the citywide aerial textures and roof colours from the LINZ 2024–2025 orthophotos."""

from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
from urllib.request import urlopen

import numpy as np
from pyproj import Transformer
import rasterio
from rasterio.features import rasterize
from scipy.ndimage import distance_transform_edt, gaussian_filter

from map_extent import WIDTH, HEIGHT, footprint_key, ground, screen

ROOT = Path(__file__).resolve().parents[1] / 'dist'
SOURCE = 'https://nz-imagery.s3.ap-southeast-2.amazonaws.com/waikato/hamilton_2024-2025_0.05m/rgb/2193'
def load_aerial():
    x, y = np.meshgrid(np.arange(WIDTH) + 0.5, np.arange(HEIGHT) + 0.5)
    east, south = ground(x, y)
    transformer = Transformer.from_crs(4326, 2193, always_xy=True)
    e, n = transformer.transform(175.286 + east / 87900, -37.792 - south / 111000)
    columns = np.floor((e - 1789600) / 480).astype(int)
    rows = np.floor((5832240 - n) / 720).astype(int)
    with urlopen(f'{SOURCE}/collection.json', timeout=30) as response:
        collection = json.load(response)
    tile_names = {Path(link['href']).stem for link in collection['links'] if link['rel'] == 'item'}
    photo = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    valid = np.zeros((HEIGHT, WIDTH), dtype=bool)

    def read_tile(task):
        row, col, name = task
        mask = (columns == col) & (rows == row)
        if not mask.any():
            return
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', GDAL_HTTP_TIMEOUT='45'):
            with rasterio.open(f'{SOURCE}/{name}.tiff', overview_level=3) as source:
                sample = source.read([1, 2, 3, 4])
                sx, sy = (~source.transform) * (e[mask], n[mask])
                sx = np.clip(sx.astype(int), 0, source.width - 1)
                sy = np.clip(sy.astype(int), 0, source.height - 1)
                photo[mask] = sample[:3, sy, sx].T
                valid[mask] = sample[3, sy, sx] > 200
        print(name, flush=True)

    tasks = []
    for row in range(rows.min(), rows.max() + 1):
        for col in range(columns.min(), columns.max() + 1):
            sheet, sheet_col = divmod(col + 20, 50)
            name = f'BD{33 + sheet}_1000_{row + 9:02}{sheet_col + 1:02}'
            if name in tile_names:
                tasks.append((row, col, name))
    with ThreadPoolExecutor(max_workers=6) as pool:
        for _ in pool.map(read_tile, tasks):
            pass
    if valid.mean() < 0.97:
        raise ValueError(f'Insufficient imagery coverage: {valid.mean():.1%}')
    print(f'Aerial coverage: {valid.mean():.2%}', flush=True)
    return photo, valid


def footprints(photo, valid):
    buildings = json.loads((ROOT / 'hamilton.json').read_text())['buildings']
    geometry = []
    keys = []
    for _, _, _, ring, *courtyards in buildings:
        x, y = screen(*np.asarray(ring).T)
        if min(x) >= WIDTH or max(x) <= 0 or min(y) >= HEIGHT or max(y) <= 0:
            continue
        holes = courtyards[0] if courtyards else []
        coordinates = [list(zip(x, y)), *(list(zip(*screen(*np.asarray(hole).T))) for hole in holes)]
        geometry.append(({'type': 'Polygon', 'coordinates': coordinates}, len(keys) + 1))
        keys.append(footprint_key(ring))
    ids = rasterize(geometry, out_shape=valid.shape, dtype='int32')
    roofs = {}
    inside = (ids > 0) & valid
    building_ids = ids[inside]
    counts = np.bincount(building_ids, minlength=len(keys) + 1)
    ends = counts.cumsum()
    grouped_pixels = photo[inside][np.argsort(building_ids, kind='stable')]
    for index, key in enumerate(keys, 1):
        pixels = grouped_pixels[ends[index - 1]:ends[index]]
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
    distance = distance_transform_edt(ids == 0)
    coverage = np.minimum(distance_transform_edt(valid) / 35, 1) if not valid.all() else 1
    opacity = coverage * np.clip((distance - 1) / 2, 0, 1) * valid * 174
    rgba = np.dstack((colour, opacity.astype(np.uint8)))
    with rasterio.open(ROOT / 'hamilton-ground.webp', 'w', driver='WEBP', quality=90,
                       width=WIDTH, height=HEIGHT, count=4, dtype='uint8') as output:
        output.write(np.moveaxis(rgba, -1, 0))
    (ROOT / 'hamilton-aerial.json').write_text(json.dumps(
        {'roofs': roofs, 'coverage': round(float(valid.mean()), 4)}, separators=(',', ':')) + '\n')
    print(f'Sampled {len(roofs)} roof colours')


if __name__ == '__main__':
    main()
