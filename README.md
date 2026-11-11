# Pixel Hamilton

An interactive pixel-art map of Kirikiriroa / Hamilton, New Zealand, inspired by [Yadong Xie's Pixel Cities](https://www.yadongxie.com/blog/how-isometric-pixel-city-was-made).

## Run locally

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open [localhost:8000](http://127.0.0.1:8000). Drag to pan, scroll or pinch to zoom, and choose a landmark to jump there. With the map focused, use the arrow keys, plus, minus, and Home.

## Map source and rendering

The bundled [OpenStreetMap](https://www.openstreetmap.org/copyright) extract was collected on 11 November 2026 and is available under the Open Database License (ODbL). It contains mapped roads, bridge alignments, building footprints, water, trees, and green spaces for central Hamilton. The browser loads the extract locally.

`dist/city.js` projects the geometry through a single orthographic camera and draws roofs, façades, shadows, canopies, roads, and shorelines. The 2023 Hamilton LiDAR survey from Toitū Te Whenua Land Information New Zealand supplies terrain shading and height estimates for 18,475 of the 19,057 mapped footprints. Heights come from the difference between the 1 m surface and bare-earth models within each footprint. Buildings without a usable estimate fall back to OpenStreetMap height or level tags, then to a procedural height. The Hamilton East elevation pilot also displaces the ground, structures and paths using the measured terrain. The rest of the map uses hillshade over a flat ground projection. The survey also provides probable canopy positions and approximate heights. The importer filters elevated returns against mapped buildings, roads, water, and paved areas. Crown shapes, roof materials, and decorative street details are illustrated. Traffic follows mapped road segments, with a separate foreground canvas for occlusion.

The bundled LiDAR derivatives use the [LINZ Hamilton 2023 DEM](https://nz-elevation.s3.ap-southeast-2.amazonaws.com/waikato/hamilton_2023/dem_1m/2193/collection.json) and [DSM](https://nz-elevation.s3.ap-southeast-2.amazonaws.com/waikato/hamilton_2023/dsm_1m/2193/collection.json), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The Victoria Bridge artwork follows its [Heritage New Zealand listing](https://www.heritage.org.nz/list-details/772/772).

`dist/viewer.js` handles the camera, inputs, landmark navigation, minimap, and reduced-motion support.

To rebuild the data file, run `python3 scripts/import-osm.py`. The importer fetches public OSM XML extracts and keeps only the geometry and tags used by the renderer. To reuse saved extracts, pass their paths as arguments.

To regenerate the LiDAR derivatives, install `numpy`, `pyproj`, `rasterio`, and `scipy` in a Python virtual environment, then run `python scripts/import-lidar.py` after importing OpenStreetMap. The script reads the public LINZ GeoTIFFs and writes the bundled `dist/hamilton-lidar.json`.

## Aerial detail

The map uses sampled roof colours and simplified ground texture derived from the [Hamilton 0.05 m Urban Aerial Photos (2024–2025)](https://data.linz.govt.nz/layer/123014-hamilton-005m-urban-aerial-photos-2024-2025/), captured for Hamilton City Council and distributed by Toitū Te Whenua LINZ under CC BY 4.0. Small roofs with insufficient imagery samples use the illustrated palette.

To regenerate the aerial assets, use the same Python environment as the LiDAR importer and run `python scripts/import-aerial.py`. It reads the public survey tiles, projects their colours into the map camera, and writes the ground WebP and roof colour table.

## Hamilton East elevation

From Victoria Bridge to Steele Park, the terrain uses samples from the 2023 LINZ bare-earth model. The bridge deck follows the grade between its mapped approaches, and the mapped river surface uses a shared elevation derived from the survey. Relief fades at the edges of the pilot area to meet the surrounding flat map.

To regenerate the elevation grid, use the LiDAR importer environment and run `python scripts/import-elevation.py`.

## Landmarks and streets

Made Hamilton and the Cathedral of the Blessed Virgin Mary have hand-modelled details on their mapped footprints. Their features are based on the [Made project record](https://www.edwardswhite.co.nz/projects/made), [Stark Property’s project description](https://www.starkproperty.co.nz/work/made-of-hamilton-east), and [PAUA Architects’ cathedral project](https://www.pauaarchitects.co.nz/individual-project-cathedral-of-the-blessed-virgin-mary). Feature dimensions are approximate. The map also models the [Waikato Museum entrance](https://hamilton.govt.nz/your-council/news/community-environment/regions-museum-back-and-better-than-ever), [Central Library frontage](https://www.eboss.co.nz/ebossnow/vantage-windows-and-doors-glazed-facade-hamilton-central-library), [Claudelands Arena façade](https://claudelands.co.nz/spaces/about/our-architecture), and [St Peter’s Cathedral](https://www.stpeter.org.nz/history/).

The OpenStreetMap importer collects mapped bus stops, cycle stands, benches, directional signals, crossings with known markings, street lamps, picnic tables, bins, and drinking fountains across the map. Crossing markings render where they can be aligned to a mapped road.

Additional close-ups cover [ArtsPost in the former Hamilton Post Office](https://www.heritage.org.nz/list-details/5299/Hamilton%20Post%20Office%20%28Former%29), the [Hamilton Gardens pavilion and entry precinct](https://bhwstudio.nz/projects/hamilton-gardens), and the pavilion, fence and grass banks at [Seddon Park](https://seddonpark.com/assets/Uploads/seddon-park-access-map.pdf).
