import { createElevation } from './elevation.js?data=2';
import { width, height, mapScale, project, places, paintCity, paintMovement, paintOverlay, paintAir, paintSky, paintClouds,
  advanceTransport } from './city.js?life=3';
import { describeVehicle, listVehicles } from './transit.js?life=3';
import { now, conditions, watchWeather, describe, paintFog, paintRain } from './sky.js?life=3';

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
  const response = await fetch(`${file}.gz?data=2`);
  if (!response.ok) throw new Error(`${file} returned HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const body = gzipped ? new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')) : new Blob([bytes]).stream();
  return new Response(body).json();
}

let layers, elevation;
try {
  const ground = new Image();
  ground.src = './hamilton-ground.webp?extent=3';
  const [map, lidar, aerial, terrain, transit] = await Promise.all([
    loadJson('hamilton.json'),
    loadJson('hamilton-lidar.json'),
    loadJson('hamilton-aerial.json'),
    loadJson('hamilton-elevation.json'),
    loadJson('hamilton-transit.json').catch(error => {
      console.warn('Bus and train timetables are unavailable.', error);
      return null;
    }),
    ground.decode(),
  ]);
  elevation = createElevation(terrain, mapScale);
  layers = paintCity(scene.getContext('2d'), map, lidar, { ground, roofs: aerial.roofs }, elevation, transit);
  status.hidden = true;
} catch (error) {
  status.textContent = 'The map could not load. Reload to try again.';
  throw error;
}
const skyLabel = document.querySelector('#sky');
const weather = watchWeather(() => {
  refreshSky();
  requestDraw();
});
let skyCheckedAt = -Infinity, cloudDrift = [0, 0], previousFrame;
function refreshSky() {
  const ms = now();
  layers.sky = conditions(ms, weather);
  layers.clock = ms / 1000;
  layers.traffic.activity = layers.sky.traffic;
  const label = describe(ms, weather);
  if (skyLabel.textContent !== label) skyLabel.textContent = label;
  skyCheckedAt = performance.now();
}
refreshSky();
setInterval(() => { if (motion.matches) requestDraw(); }, 60000);
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
paintOverlay(composed, layers, 0, mapBounds, 0);
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
  const animate = !motion.matches;
  if (performance.now() - skyCheckedAt > 5000) refreshSky();
  layers.clock = now() / 1000;
  const sky = layers.sky;
  const elapsed = previousFrame === undefined ? 0 : Math.min(0.2, (time - previousFrame) / 1000);
  previousFrame = time;
  advanceTransport(layers, time / 1000, !(animate && scale > 0.55));
  const followed = follow(elapsed);
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
  cloudDrift = cloudDrift.map((value, axis) => value + sky.wind[axis] * elapsed);
  if (animate && scale > 0.55) {
    context.drawImage(scene, ...region, ...region);
    paintMovement(context, layers, time / 1000, bounds);
    context.drawImage(layers.foreground, ...region, ...region);
    paintOverlay(context, layers, time / 1000, bounds, scale);
  } else {
    context.drawImage(composite, ...region, ...region);
  }
  paintAir(context, layers, bounds);
  paintSky(context, layers, time / 1000, bounds, scale);
  if (animate) paintClouds(context, layers.clouds, cloudDrift, bounds, sky.shadows);
  if (followed) paintTrackingMarker(followed, time / 1000);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  paintFog(context, sky, layers.clock, viewportWidth, viewportHeight);
  if (animate) paintRain(context, sky, time / 1000, viewportWidth, viewportHeight, scale);

  layoutLabels();

  miniContext.drawImage(miniBase, 0, 0);
  miniContext.globalCompositeOperation = 'multiply';
  miniContext.fillStyle = `rgb(${sky.tint.map(Math.round).join(', ')})`;
  miniContext.fillRect(0, 0, mini.width, mini.height);
  miniContext.globalCompositeOperation = 'source-over';
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
  stopTracking();
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
    if (tracked !== null && Math.hypot(current[0] - previous[0], current[1] - previous[1]) > 0) stopTracking();
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
    case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown':
      stopTracking();
      x += event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      y += event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      break;
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

const busButton = document.querySelector('#find-bus');
const busDialog = document.querySelector('#buses');
const busSearch = document.querySelector('#bus-search');
const busList = document.querySelector('#bus-list');
const busEmpty = document.querySelector('#bus-empty');
let tracked = null, trackedLabel = null, trackedLine = '';

const clockTime = seconds => {
  const day = ((Math.floor(seconds / 60) % 1440) + 1440) % 1440;
  const hour = Math.floor(day / 60), minute = day % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
};

function badge({ name, colour, text }) {
  const element = document.createElement('span');
  element.className = 'route-badge';
  element.textContent = name;
  element.style.background = colour;
  element.style.color = text;
  if (colour.toLowerCase() === '#000000') element.style.boxShadow = 'inset 0 0 0 1px #e6dfc96e';
  return element;
}

const nextLine = info => info.stopped ? `At ${info.next}` : `Next stop ${info.next} · due ${clockTime(info.nextAt)}`;

function renderBuses() {
  const query = busSearch.value.trim().toLowerCase();
  const inMap = (px, py) => px >= 0 && px <= width && py >= 0 && py <= height;
  const vehicles = listVehicles(layers.transit, inMap)
    .filter(info => !query || [info.name, info.title, info.headsign, info.next].some(value => value.toLowerCase().includes(query)))
    .sort((a, b) => Number(a.train) - Number(b.train) || a.name.localeCompare(b.name, 'en', { numeric: true })
      || a.headsign.localeCompare(b.headsign));
  busList.replaceChildren(...vehicles.map(info => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    const what = document.createElement('span');
    what.className = 'bus-what';
    const title = document.createElement('strong');
    title.textContent = info.train ? info.headsign : `${info.title} · ${info.headsign}`;
    const detail = document.createElement('span');
    detail.textContent = nextLine(info);
    what.append(title, detail);
    button.append(badge(info), what);
    button.addEventListener('click', () => {
      busDialog.close();
      track(info.key);
    });
    item.append(button);
    return item;
  }));
  busEmpty.hidden = vehicles.length > 0;
  busEmpty.textContent = query ? 'No buses or trains on the map match that search.' : 'No buses or trains are on the map right now.';
}

function track(key) {
  const info = describeVehicle(layers.transit, key);
  if (!info) return;
  stopTracking();
  selection = -1;
  select.value = '';
  tracked = key;
  [x, y] = [info.x, info.y];
  scale = clampScale(Math.max(scale, 2.4));
  const title = document.createElement('h2');
  title.className = 'tracking-title';
  const name = document.createElement('span');
  name.textContent = info.train ? 'Train' : info.title;
  title.append(badge(info), name);
  const heading = document.createElement('p');
  heading.textContent = info.headsign;
  trackedLabel = document.createElement('p');
  trackedLabel.className = 'tracking-next';
  trackedLabel.setAttribute('aria-live', 'polite');
  trackedLine = nextLine(info);
  trackedLabel.textContent = trackedLine;
  const stop = document.createElement('button');
  stop.type = 'button';
  stop.className = 'stop-tracking';
  stop.textContent = 'Stop tracking';
  stop.addEventListener('click', () => {
    stopTracking();
    canvas.focus({ preventScroll: true });
  });
  detail.replaceChildren(title, heading, trackedLabel, stop);
  detail.hidden = false;
  busButton.setAttribute('aria-pressed', 'true');
  constrain();
  requestDraw();
}

function stopTracking(message) {
  if (tracked === null) return;
  tracked = null;
  trackedLabel = null;
  busButton.setAttribute('aria-pressed', 'false');
  if (message) {
    const note = document.createElement('p');
    note.textContent = message;
    detail.replaceChildren(note);
  } else detail.hidden = true;
}

function follow(elapsed) {
  if (tracked === null) return null;
  const info = describeVehicle(layers.transit, tracked);
  if (!info) {
    stopTracking('That trip has finished.');
    return null;
  }
  const pull = elapsed ? 1 - Math.exp(-elapsed * 5) : 1;
  x += (info.x - x) * pull;
  y += (info.y - y) * pull;
  constrain();
  const line = nextLine(info);
  if (trackedLabel && line !== trackedLine) {
    trackedLine = line;
    trackedLabel.textContent = line;
  }
  return info;
}

function paintTrackingMarker(info, seconds) {
  const pulse = (Math.sin(seconds * 4) + 1) / 2;
  context.save();
  context.strokeStyle = '#f6df9e';
  context.lineWidth = 2 / scale;
  context.globalAlpha = 0.55 + pulse * 0.45;
  context.beginPath();
  context.arc(info.x, info.y - 1, (9 + pulse * 3) / scale, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;
  context.fillStyle = '#f6df9e';
  const tip = info.y - 1 - (14 + pulse * 3) / scale;
  context.beginPath();
  context.moveTo(info.x, tip);
  context.lineTo(info.x - 5 / scale, tip - 7 / scale);
  context.lineTo(info.x + 5 / scale, tip - 7 / scale);
  context.closePath();
  context.fill();
  context.restore();
}

if (layers.transit) {
  busButton.hidden = false;
  busButton.setAttribute('aria-pressed', 'false');
  busButton.addEventListener('click', () => {
    busSearch.value = '';
    renderBuses();
    busDialog.showModal();
    busSearch.focus();
  });
  busSearch.addEventListener('input', renderBuses);
  document.querySelector('#close-buses').addEventListener('click', () => busDialog.close());
  busDialog.addEventListener('click', event => {
    if (event.target === busDialog) busDialog.close();
  });
}

const atlas = document.querySelector('#atlas');
const zenButton = document.querySelector('#zen');

function setZen(on) {
  atlas.classList.toggle('zen', on);
  zenButton.setAttribute('aria-pressed', String(on));
  zenButton.setAttribute('aria-label', on ? 'Leave zen mode' : 'Zen mode');
  zenButton.title = on ? 'Leave zen mode (Esc)' : 'Zen mode (Z)';
  previousLabelView = '';
  requestDraw();
}

zenButton.addEventListener('click', () => setZen(!atlas.classList.contains('zen')));
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest?.('input, select, textarea, dialog')) return;
  if (event.key === 'z' || event.key === 'Z') setZen(!atlas.classList.contains('zen'));
  else if (event.key === 'Escape' && atlas.classList.contains('zen')) setZen(false);
  else return;
  event.preventDefault();
});
