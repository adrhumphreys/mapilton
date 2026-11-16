import { measure, locate, hash } from './paths.js?life=3';

const binSize = 128;
const glowScale = 4;
const windowColours = [[216, 187, 124], [82, 106, 104], [65, 92, 97]];
const lampSpacing = 34;

const binKey = (x, y) => Math.floor(x / binSize) * 4096 + Math.floor(y / binSize);

function addToBins(bins, item) {
  const key = binKey(item.x, item.y);
  if (!bins.has(key)) bins.set(key, []);
  bins.get(key).push(item);
}

function* inView(bins, bounds) {
  for (let col = Math.floor(bounds.left / binSize) - 1; col <= Math.floor(bounds.right / binSize); col++) {
    for (let row = Math.floor(bounds.top / binSize) - 1; row <= Math.floor(bounds.bottom / binSize); row++) {
      const items = bins.get(col * 4096 + row);
      if (items) yield* items;
    }
  }
}

const isWindow = ([r, g, b, a]) => a > 200
  && windowColours.some(([wr, wg, wb]) => Math.abs(r - wr) < 7 && Math.abs(g - wg) < 7 && Math.abs(b - wb) < 7);

function sprite(width, height, colour, strength) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.translate(width / 2, height / 2);
  ctx.scale(1, height / width);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, width / 2);
  glow.addColorStop(0, `rgba(${colour}, ${strength})`);
  glow.addColorStop(0.45, `rgba(${colour}, ${strength * 0.45})`);
  glow.addColorStop(1, `rgba(${colour}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(-width / 2, -width / 2, width, width);
  return canvas;
}

export function createNight({ windows, routes, details, project, elevation, pixel, width, height, mapScale }) {
  const windowBins = new Map(), lampBins = new Map(), lit = [], lamps = [];
  windows.forEach(([x, y, size, house], index) => {
    if (!isWindow(pixel(x, y))) return;
    const window = { x, y, size, house, seed: hash(index, 911), tone: hash(index, 577) };
    lit.push(window);
    addToBins(windowBins, window);
  });
  for (const [kind, east, south] of details) {
    if (kind !== 'lamp') continue;
    const [x, y] = elevation.point(project(east, south));
    lamps.push({ x: Math.round(x) + 1.5, y: Math.round(y), head: 7, mapped: true });
  }
  for (const route of routes) {
    if (route.size < 6 || route.kind === 'rail' || route.tunnel) continue;
    const road = measure(route.points);
    const kerb = route.size * 0.5 * mapScale + 1;
    let side = 1;
    for (let along = lampSpacing / 2; along < road.distance; along += lampSpacing) {
      const [x, y, dx, dy] = locate(road, along);
      lamps.push({ x: x + dy * kerb * side, y: y - dx * kerb * side, head: 0, mapped: false });
      side = -side;
    }
  }
  for (const lamp of lamps) addToBins(lampBins, lamp);
  const glow = document.createElement('canvas');
  glow.width = Math.ceil(width / glowScale);
  glow.height = Math.ceil(height / glowScale);
  return {
    windowBins, lampBins, lit, lamps, glow, glowKey: '',
    pool: sprite(22, 12, '255, 196, 112', 0.34),
    halo: sprite(8, 8, '255, 214, 150', 0.7),
    beam: sprite(14, 8, '255, 232, 172', 0.55),
  };
}

const windowColour = tone => tone < 0.08 ? '#9fc0ff' : tone < 0.4 ? '#ffe2a0' : tone < 0.75 ? '#ffd27c' : '#f5bd66';

function refreshGlow(night, sky) {
  const house = sky.windows(true), office = sky.windows(false);
  const key = [house, office].map(value => Math.round(value * 40)).join();
  if (key === night.glowKey) return;
  night.glowKey = key;
  const ctx = night.glow.getContext('2d');
  ctx.clearRect(0, 0, night.glow.width, night.glow.height);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255, 196, 110, 0.5)';
  for (const { x, y, house: home, seed } of night.lit) {
    if (seed >= (home ? house : office)) continue;
    ctx.fillRect(x / glowScale - 0.5, y / glowScale - 0.5, 1, 1);
  }
  ctx.fillStyle = 'rgba(255, 190, 100, 0.3)';
  for (const { x, y } of night.lamps) ctx.fillRect(x / glowScale - 1, y / glowScale - 0.6, 2, 1.2);
}

export function paintNight(ctx, night, sky, bounds, scale) {
  if (sky.lights <= 0) return;
  refreshGlow(night, sky);
  const house = sky.windows(true), office = sky.windows(false);
  ctx.save();
  ctx.globalAlpha = sky.lights;
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  const sx = bounds.left / glowScale, sy = bounds.top / glowScale;
  const sw = (bounds.right - bounds.left) / glowScale, sh = (bounds.bottom - bounds.top) / glowScale;
  for (let pass = scale > 0.55 ? 1 : 3; pass > 0; pass--) {
    ctx.drawImage(night.glow, sx, sy, sw, sh, bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  }
  if (scale > 0.55) {
    for (const { x, y } of inView(night.lampBins, bounds)) {
      ctx.drawImage(night.pool, Math.round(x) - 11, Math.round(y) - 6);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  if (scale > 0.55) {
    for (const { x, y, size, house: home, seed, tone } of inView(night.windowBins, bounds)) {
      if (seed >= (home ? house : office)) continue;
      ctx.fillStyle = windowColour(tone);
      ctx.fillRect(x, y, size, 1.35);
    }
    ctx.fillStyle = '#fff3c8';
    for (const { x, y, head, mapped } of inView(night.lampBins, bounds)) {
      if (mapped) ctx.fillRect(Math.round(x) - 0.5, Math.round(y) - head, 1.5, 0.8);
    }
  }
  ctx.restore();
}

export function paintHalo(ctx, night, x, y) {
  ctx.drawImage(night.halo, Math.round(x) - 4, Math.round(y) - 4);
}
