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

`dist/city.js` projects the geometry through a single orthographic camera and draws roofs, façades, shadows, canopies, roads, and shorelines. The 2023 Hamilton LiDAR survey from Toitū Te Whenua Land Information New Zealand supplies terrain shading and height estimates for 18,475 of the 19,057 mapped footprints. Heights come from the difference between the 1 m surface and bare-earth models within each footprint. Buildings without a usable estimate fall back to OpenStreetMap height or level tags, then to a procedural height. Hillshade shows relief over a flat ground projection. Roof materials, vegetation outside mapped tree positions, and decorative street details are illustrated. Traffic follows mapped road segments, with a separate foreground canvas for occlusion.

The bundled LiDAR derivatives use the [LINZ Hamilton 2023 DEM](https://nz-elevation.s3.ap-southeast-2.amazonaws.com/waikato/hamilton_2023/dem_1m/2193/collection.json) and [DSM](https://nz-elevation.s3.ap-southeast-2.amazonaws.com/waikato/hamilton_2023/dsm_1m/2193/collection.json), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The Victoria Bridge artwork follows its [Heritage New Zealand listing](https://www.heritage.org.nz/list-details/772/772).

`dist/viewer.js` handles the camera, inputs, landmark navigation, minimap, and reduced-motion support.

To rebuild the data file, run `python3 scripts/import-osm.py`. The importer fetches public OSM XML extracts and keeps only the geometry and tags used by the renderer. To reuse saved extracts, pass their paths as arguments.

To regenerate the LiDAR derivatives, install `numpy`, `pyproj`, and `rasterio` in a Python virtual environment, then run `python scripts/import-lidar.py` after importing OpenStreetMap. The script reads the public LINZ GeoTIFFs and writes the bundled `dist/hamilton-lidar.json`.
