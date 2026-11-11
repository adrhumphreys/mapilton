import { createElevation } from './elevation.js?extent=3';
import { width, height, mapScale, project, places, paintCity, paintMovement, paintBirds } from './city.js?activity=1';

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
  const response = await fetch(`${file}?extent=3`);
  if (!response.ok) throw new Error(`${file} returned HTTP ${response.status}`);
  return response.json();
}

let layers, elevation;
try {
  const ground = new Image();
  ground.src = './hamilton-ground.webp?extent=3';
  const [map, lidar, aerial, terrain] = await Promise.all([
    loadJson('hamilton.json'),
    loadJson('hamilton-lidar.json'),
    loadJson('hamilton-aerial.json'),
    loadJson('hamilton-elevation.json'),
    ground.decode(),
  ]);
  elevation = createElevation(terrain, mapScale);
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
const miniInsetX = (mini.width - width * miniScale) / 2;
const miniInsetY = (mini.height - height * miniScale) / 2;
composed.drawImage(scene, 0, 0);
paintMovement(composed, layers, 0, mapBounds);
composed.drawImage(layers.foreground, 0, 0);
paintBirds(composed, layers.birds, 0, mapBounds);
miniPaint.fillStyle = '#1c3331';
miniPaint.fillRect(0, 0, mini.width, mini.height);
miniPaint.drawImage(composite, miniInsetX, miniInsetY, width * miniScale, height * miniScale);
let lastFrame = 0;

let viewportWidth, viewportHeight, ratio, minimumScale;
const startX = width / 2;
let x = startX, y = height / 2, scale;
let selection = -1;
let frame;
const pointers = new Map();

const position = place => layers.bridgeMarkers.get(place) ?? elevation.point(project(place.x, place.y));
const overviewLandmarks = new Set([
  'The Base · Te Rapa', 'University of Waikato', 'Hamilton Gardens',
  'Lake Rotoroa', 'Garden Place', 'FMG Stadium Waikato',
]);
const mapOverlays = [...document.querySelectorAll('header, .places, #detail, .tools, footer')];
let previousLabelView = '';

const markers = places.map((place, index) => {
  const button = document.createElement('button');
  button.className = 'marker';
  button.textContent = place.name;
  button.addEventListener('click', () => {
    choose(index);
    if (place.hidePinAtCloseZoom || place.hideSelectedPin) canvas.focus({ preventScroll: true });
  });
  document.querySelector('#markers').append(button);
  select.add(new Option(place.name, index));
  return { button, point: position(place), place, index, overview: overviewLandmarks.has(place.name) };
});

function measureLabels() {
  const hidden = markers.map(({ button }) => button.hidden);
  for (const { button } of markers) button.hidden = false;
  for (const marker of markers) {
    marker.width = marker.button.offsetWidth;
    marker.height = marker.button.offsetHeight;
  }
  markers.forEach(({ button }, index) => { button.hidden = hidden[index]; });
  previousLabelView = '';
}

function layoutLabels() {
  const view = [x, y, scale, selection].join(',');
  if (view === previousLabelView) return;
  previousLabelView = view;
  const map = canvas.getBoundingClientRect();
  const occupied = mapOverlays.filter(element => !element.hidden).map(element => {
    const box = element.getBoundingClientRect();
    return [box.left - map.left, box.top - map.top, box.right - map.left, box.bottom - map.top];
  });
  const wide = scale < Math.max(0.28, minimumScale * 1.18);
  const priority = marker => marker.index === selection ? 0 : marker.overview ? 1 : 2;
  for (const marker of [...markers].sort((a, b) => priority(a) - priority(b))) {
    const { button, point, place, index, overview, width, height } = marker;
    const selected = index === selection;
    const px = (point[0] - x) * scale + viewportWidth / 2;
    const py = (point[1] - y) * scale + viewportHeight / 2;
    const left = px - width / 2, right = px + width / 2, top = py - height, bottom = py + 4;
    button.hidden = left < 8 || right > viewportWidth - 8 || top < 8 || bottom > viewportHeight - 8
      || (!selected && ((wide && !overview) || (place.hidePinAtCloseZoom && scale < 0.7)))
      || (selected && (place.hidePinAtCloseZoom || place.hideSelectedPin) && scale >= 2 && !button.matches(':focus'))
      || occupied.some(([l, t, r, b]) => left < r + 7 && right > l - 7 && top < b + 5 && bottom > t - 5);
    button.setAttribute('aria-pressed', String(selected));
    if (button.hidden) continue;
    button.style.left = px + 'px';
    button.style.top = py + 'px';
    occupied.push([left, top, right, bottom]);
  }
}

function resize() {
  viewportWidth = canvas.clientWidth;
  viewportHeight = canvas.clientHeight;
  ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(viewportWidth * ratio);
  canvas.height = Math.round(viewportHeight * ratio);
  const previous = minimumScale;
  minimumScale = Math.max(viewportWidth / width, viewportHeight / height);
  scale = previous ? clampScale(scale * minimumScale / previous) : minimumScale;
  constrain();
  measureLabels();
  requestDraw();
}

function requestDraw() {
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
}

function draw(time) {
  frame = undefined;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = '#223934';
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

  layoutLabels();

  miniContext.drawImage(miniBase, 0, 0);
  miniContext.strokeStyle = '#fff2bf';
  miniContext.lineWidth = 1.5;
  miniContext.strokeRect(miniInsetX + left * miniScale + 1, miniInsetY + top * miniScale + 1,
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

function clampScale(value) {
  return Math.max(minimumScale, Math.min(4, value));
}

function zoom(factor, px = viewportWidth / 2, py = viewportHeight / 2) {
  const next = clampScale(scale * factor);
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
    scale = minimumScale;
  } else {
    const place = places[index];
    [x, y] = position(place);
    x += place.viewOffsetX ?? 0;
    scale = clampScale(Math.max(minimumScale * 2.5, place.viewScale ?? 1.65));
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
