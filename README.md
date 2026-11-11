# Pixel Hamilton

An interactive pixel-art sketch of Kirikiriroa / Hamilton, New Zealand, inspired by [Yadong Xie's Pixel Cities](https://www.yadongxie.com/blog/how-isometric-pixel-city-was-made).

## Run locally

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open [localhost:8000](http://127.0.0.1:8000). Drag to pan, scroll or pinch to zoom, and select a landmark to jump there. With the map focused, use the arrow keys, plus, minus, and Home.

## Map source

The first pass uses a hand-authored schematic and a seeded Canvas renderer. The roads and building footprints are illustrative. The landmark arrangement was informed by the [Hamilton CBD visitor map](https://www.waikatonz.com/media/eiahywef/2024-hwt-visitor-guide-1.pdf) and the [Hamilton Gardens map](https://hamiltongardens.co.nz/public/assets/Uploads/Maps/Hamilton-Gardens-Map.pdf).

The scene and projection live in `dist/city.js`. The camera, input, and landmark UI live in `dist/viewer.js`. Everything runs locally with no build step, runtime dependencies, or API keys.
