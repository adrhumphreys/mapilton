import { createElevation } from './elevation.js';
import { width, height, project, places, paintCity, paintMovement, paintBirds } from './city.js';

const canvas = document.querySelector('#map');
const context = canvas.getContext('2d');
const mini = document.querySelector('#mini');
const miniContext = mini.getContext('2d');
const detail = document.querySelector('#detail');
const select = document.querySelector('#places');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const scene = document.createElement('canvas');
scene.width = width;
scene.height = height;
const status = document.querySelector('#loading');
async function loadJson(file) {
  const response = await fetch(file);
  if (!response.ok) throw new Error(`${file} returned HTTP ${response.status}`);
  return response.json();
}

let layers, elevation;
try {
  const ground = new Image();
  ground.src = './hamilton-ground.webp';
  const [map, lidar, aerial, terrain] = await Promise.all([
    loadJson('hamilton.json'),
    loadJson('hamilton-lidar.json'),
    loadJson('hamilton-aerial.json'),
    loadJson('hamilton-elevation.json'),
    ground.decode(),
  ]);
  elevation = createElevation(terrain);
  layers = paintCity(scene.getContext('2d'), map, lidar, { ground, roofs: aerial.roofs }, elevation);
  status.hidden = true;
} catch (error) {
  status.textContent = 'The map could not load. Reload to try again.';
  throw error;
}
const composite = document.createElement('canvas');
composite.width = width;
composite.height = height;
const composed = composite.getContext('2d');
const mapBounds = { left: 0, top: 0, right: width, bottom: height };
const miniBase = document.createElement('canvas');
miniBase.width = mini.width;
miniBase.height = mini.height;
const miniPaint = miniBase.getContext('2d');
const miniScale = Math.min(mini.width / width, mini.height / height);
const miniInset = (mini.width - width * miniScale) / 2;
composed.drawImage(scene, 0, 0);
paintMovement(composed, layers, 0, mapBounds);
composed.drawImage(layers.foreground, 0, 0);
paintBirds(composed, layers.birds, 0, mapBounds);
miniPaint.fillStyle = '#1c3331';
miniPaint.fillRect(0, 0, mini.width, mini.height);
miniPaint.drawImage(composite, miniInset, 0, width * miniScale, height * miniScale);
let lastFrame = 0;

let viewportWidth, viewportHeight, ratio, overviewScale;
const startX = width * 0.34;
let x = startX, y = height / 2, scale;
let selection = -1;
let frame;
const pointers = new Map();

const position = place => layers.bridgeMarkers.get(place) ?? elevation.point(project(place.x, place.y));

const markers = places.map((place, index) => {
  const button = document.createElement('button');
  button.className = 'marker';
  button.textContent = place.name;
  button.addEventListener('click', () => choose(index));
  document.querySelector('#markers').append(button);
  select.add(new Option(place.name, index));
  return { button, point: position(place) };
});

function resize() {
  viewportWidth = canvas.clientWidth;
  viewportHeight = canvas.clientHeight;
  ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(viewportWidth * ratio);
  canvas.height = Math.round(viewportHeight * ratio);
  const previous = overviewScale;
  overviewScale = Math.max(viewportWidth / width, viewportHeight / height);
  scale = previous ? Math.min(4, scale * overviewScale / previous) : overviewScale;
  constrain();
  requestDraw();
}

function requestDraw() {
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
}

function draw(time) {
  frame = undefined;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = '#a8b37b';
  context.fillRect(0, 0, viewportWidth, viewportHeight);
  context.translate(viewportWidth / 2 - x * scale, viewportHeight / 2 - y * scale);
  context.scale(scale, scale);
  context.imageSmoothingEnabled = scale < 1;
  const halfW = viewportWidth / (2 * scale);
  const halfH = viewportHeight / (2 * scale);
  const left = Math.max(0, Math.floor(x - halfW));
  const top = Math.max(0, Math.floor(y - halfH));
  const right = Math.min(width, Math.ceil(x + halfW));
  const bottom = Math.min(height, Math.ceil(y + halfH));
  const bounds = { left, top, right, bottom };
  const region = [left, top, right - left, bottom - top];
  const animate = !motion.matches && scale > 0.55;
  if (animate) {
    context.drawImage(scene, ...region, ...region);
    paintMovement(context, layers, time / 1000, bounds);
    context.drawImage(layers.foreground, ...region, ...region);
    paintBirds(context, layers.birds, time / 1000, bounds);
  } else {
    context.drawImage(composite, ...region, ...region);
  }

  for (const [index, { button, point }] of markers.entries()) {
    const px = (point[0] - x) * scale + viewportWidth / 2;
    const py = (point[1] - y) * scale + viewportHeight / 2;
    button.style.left = px + 'px';
    button.style.top = py + 'px';
    button.hidden = px < 55 || px > viewportWidth - 55 || py < 116 || py > viewportHeight - 25
      || (viewportWidth < 480 && selection === -1 && (index === 1 || index === 2));
    button.setAttribute('aria-pressed', String(index === selection));
  }

  miniContext.drawImage(miniBase, 0, 0);
  miniContext.strokeStyle = '#fff2bf';
  miniContext.lineWidth = 1.5;
  miniContext.strokeRect(miniInset + left * miniScale + 1, top * miniScale + 1,
    Math.max(0, (right - left) * miniScale - 2), Math.max(0, (bottom - top) * miniScale - 2));
  if (animate) {
    lastFrame = time;
    frame = requestAnimationFrame(tick);
  }
}

function tick(time) {
  if (time - lastFrame < 40) frame = requestAnimationFrame(tick);
  else draw(time);
}

function constrain() {
  const marginX = Math.min(viewportWidth / (2 * scale), width / 2);
  const marginY = Math.min(viewportHeight / (2 * scale), height / 2);
  x = Math.max(marginX, Math.min(width - marginX, x));
  y = Math.max(marginY, Math.min(height - marginY, y));
}

function zoom(factor, px = viewportWidth / 2, py = viewportHeight / 2) {
  const next = Math.max(overviewScale, Math.min(4, scale * factor));
  x += (px - viewportWidth / 2) * (1 / scale - 1 / next);
  y += (py - viewportHeight / 2) * (1 / scale - 1 / next);
  scale = next;
  constrain();
  requestDraw();
}

function choose(index) {
  selection = index;
  select.value = index === -1 ? '' : String(index);
  detail.hidden = index === -1;
  if (index === -1) {
    x = startX;
    y = height / 2;
    scale = overviewScale;
  } else {
    const place = places[index];
    [x, y] = position(place);
    x += place.viewOffsetX ?? 0;
    scale = Math.min(4, Math.max(overviewScale * 2.5, place.viewScale ?? 1.65));
    const title = document.createElement('h2');
    const description = document.createElement('p');
    title.textContent = place.name;
    description.textContent = place.text;
    detail.replaceChildren(title, description);
  }
  constrain();
  requestDraw();
}

select.addEventListener('change', () => choose(select.value === '' ? -1 : Number(select.value)));
document.querySelector('#in').addEventListener('click', () => zoom(1.35));
document.querySelector('#out').addEventListener('click', () => zoom(1 / 1.35));
document.querySelector('#home').addEventListener('click', () => choose(-1));

canvas.addEventListener('wheel', event => {
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportHeight : 1;
  zoom(Math.exp(-event.deltaY * unit * 0.002), event.offsetX, event.offsetY);
}, { passive: false });

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || pointers.size >= 2) return;
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, [event.clientX, event.clientY]);
});
canvas.addEventListener('pointermove', event => {
  const previous = pointers.get(event.pointerId);
  if (!previous) return;
  const current = [event.clientX, event.clientY];
  pointers.set(event.pointerId, current);
  if (pointers.size === 2) {
    const other = [...pointers].find(([id]) => id !== event.pointerId)[1];
    const before = Math.hypot(previous[0] - other[0], previous[1] - other[1]);
    const after = Math.hypot(current[0] - other[0], current[1] - other[1]);
    const bounds = canvas.getBoundingClientRect();
    x -= (current[0] - previous[0]) / (2 * scale);
    y -= (current[1] - previous[1]) / (2 * scale);
    if (before > 0 && after > 0) {
      zoom(after / before, (current[0] + other[0]) / 2 - bounds.left,
        (current[1] + other[1]) / 2 - bounds.top);
    }
  } else {
    x -= (current[0] - previous[0]) / scale;
    y -= (current[1] - previous[1]) / scale;
  }
  constrain();
  requestDraw();
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(name, event => pointers.delete(event.pointerId));
}

canvas.addEventListener('keydown', event => {
  const step = 48 / scale;
  switch (event.key) {
    case '+': case '=': zoom(1.35); break;
    case '-': zoom(1 / 1.35); break;
    case 'ArrowLeft': x -= step; break;
    case 'ArrowRight': x += step; break;
    case 'ArrowUp': y -= step; break;
    case 'ArrowDown': y += step; break;
    case 'Home': choose(-1); break;
    default: return;
  }
  event.preventDefault();
  constrain();
  requestDraw();
});

motion.addEventListener('change', requestDraw);
new ResizeObserver(resize).observe(canvas);
resize();
