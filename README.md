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

`dist/city.js` projects the geometry through a single orthographic camera and draws roofs, façades, shadows, canopies, roads, and shorelines. Building heights use mapped height or floor-count tags when available. Untagged heights, roof forms, materials, and some vegetation are illustrative. Traffic follows mapped road segments, with a separate foreground canvas for occlusion. Terrain is flat, and the artwork is rendered procedurally.

`dist/viewer.js` handles the camera, inputs, landmark navigation, minimap, and reduced-motion support.

To rebuild the data file, run `python3 scripts/import-osm.py`. The importer fetches public OSM XML extracts and keeps only the geometry and tags used by the renderer. To reuse saved extracts, pass their paths as arguments.
