import { hash } from './paths.js?life=3';
import { roadLimit, board } from './traffic.js?life=3';

const spacing = 3;
const cell = 32;
const busLength = 10;
const busDwell = 10;
const layover = 90;
const freightSlot = 1800;
const freightSpeed = 9;
const carriage = { gap: 0.8, loco: 9.5, wagon: 8.2, coach: 11 };
const containers = ['#b8433a', '#2f6fb0', '#e0a33a', '#3f7f5f', '#7a7f86', '#d7d2c4', '#5a3f8c'];

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function serviceDay(ms) {
  const parts = Object.fromEntries(dayFormat.formatToParts(ms).map(({ type, value }) => [type, value]));
  return {
    date: Number(parts.year + parts.month + parts.day),
    weekday: weekdays.indexOf(parts.weekday),
    seconds: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second) + (ms % 1000) / 1000,
  };
}

const runs = ({ days, start, end, add, remove }, { date, weekday }) =>
  !remove.includes(date) && (add.includes(date) || (date >= start && date <= end && days[weekday] === '1'));

function segmentGrid(routes, accept) {
  const grid = new Map();
  for (const route of routes) {
    if (!accept(route)) continue;
    let along = 0;
    for (let i = 1; i < route.flat.length; i++) {
      const a = route.flat[i - 1], b = route.flat[i];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 0.01) continue;
      const segment = { route, a, b, length, dx: (b[0] - a[0]) / length, dy: (b[1] - a[1]) / length, start: along };
      for (let cx = Math.floor(Math.min(a[0], b[0]) / cell); cx <= Math.floor(Math.max(a[0], b[0]) / cell); cx++) {
        for (let cy = Math.floor(Math.min(a[1], b[1]) / cell); cy <= Math.floor(Math.max(a[1], b[1]) / cell); cy++) {
          const key = cx * 8192 + cy;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(segment);
        }
      }
      along += length;
    }
    route.flatDistance = along;
  }
  return grid;
}

function snap(grid, x, y, dx, dy, within) {
  let best = null, score = within;
  const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
  for (let i = cx - 1; i <= cx + 1; i++) {
    for (let j = cy - 1; j <= cy + 1; j++) {
      for (const segment of grid.get(i * 8192 + j) ?? []) {
        const alignment = segment.dx * dx + segment.dy * dy;
        if (Math.abs(alignment) < 0.55) continue;
        const t = Math.max(0, Math.min(segment.length, (x - segment.a[0]) * segment.dx + (y - segment.a[1]) * segment.dy));
        const px = segment.a[0] + segment.dx * t, py = segment.a[1] + segment.dy * t;
        const fit = Math.hypot(x - px, y - py) - Math.min(segment.route.size, 11) * 0.12;
        if (fit >= score) continue;
        score = fit;
        best = { segment, px, py, along: segment.start + t, forward: alignment > 0 };
      }
    }
  }
  return best;
}

function lifted(route, px, py, elevation) {
  if (!route.bridge) return elevation.point([px, py]);
  const a = route.flat[0], b = route.flat.at(-1);
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const fraction = span ? Math.min(1, Math.hypot(px - a[0], py - a[1]) / span) : 0;
  return [px, py - (elevation.lift(...a) * (1 - fraction) + elevation.lift(...b) * fraction)];
}

function buildPath(line, grid, elevation, within, hideLoose) {
  const xs = [], ys = [], ds = [], hidden = [], routes = [], alongs = [], forward = [];
  let carry = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay, ad] = line[i - 1], [bx, by, bd] = line[i];
    const length = Math.hypot(bx - ax, by - ay);
    if (length < 0.01) continue;
    const dx = (bx - ax) / length, dy = (by - ay) / length;
    for (let t = carry; t < length; t += spacing) {
      const x = ax + dx * t, y = ay + dy * t;
      const hit = snap(grid, x, y, dx, dy, within);
      const [lx, ly] = hit ? lifted(hit.segment.route, hit.px, hit.py, elevation) : elevation.point([x, y]);
      xs.push(lx);
      ys.push(ly);
      ds.push(ad + (bd - ad) * t / length);
      hidden.push(!hit && hideLoose);
      routes.push(hit ? hit.segment.route : null);
      alongs.push(hit ? hit.along : 0);
      forward.push(hit ? hit.forward : true);
      carry = t + spacing - length;
    }
  }
  return { xs, ys, ds, hidden, routes, alongs, forward, count: xs.length };
}

function indexAt(path, d) {
  const { ds, count } = path;
  if (d <= ds[0]) return 0;
  if (d >= ds[count - 1]) return count - 1;
  let low = 0, high = count - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (ds[middle] <= d) low = middle;
    else high = middle;
  }
  const span = ds[high] - ds[low];
  return low + (span > 0 ? (d - ds[low]) / span : 0);
}

function pose(path, index) {
  const last = path.count - 1;
  const f = Math.max(0, Math.min(last, index));
  const i = Math.min(last - 1, Math.floor(f)), t = f - i;
  const x = path.xs[i] + (path.xs[i + 1] - path.xs[i]) * t;
  const y = path.ys[i] + (path.ys[i + 1] - path.ys[i]) * t;
  const from = Math.max(0, i - 2), to = Math.min(last, i + 3);
  const dx = path.xs[to] - path.xs[from], dy = path.ys[to] - path.ys[from];
  const length = Math.hypot(dx, dy) || 1;
  return { x, y, dx: dx / length, dy: dy / length, hidden: path.hidden[Math.round(f)], sample: Math.round(f) };
}

function decode(trip, text) {
  const [route, service, shape, headsign, ...encoded] = trip;
  const stops = [];
  let clock = 0, distance = 0;
  for (let i = 0; i < encoded.length; i += 4) {
    const arrival = clock + encoded[i];
    const departure = arrival + encoded[i + 1];
    distance += encoded[i + 2];
    stops.push({ arrival, departure, distance, name: text[encoded[i + 3]] });
    clock = departure;
  }
  return { route, service, shape, headsign: text[headsign], stops };
}

const ease = p => p * p * (3 - 2 * p);

function target({ stops }, seconds, train) {
  const first = stops[0], last = stops.at(-1);
  if (seconds < first.arrival - layover || seconds > last.departure + 30) return null;
  if (seconds <= first.departure) return first.distance;
  if (seconds >= last.arrival) return last.distance;
  let i = 0;
  while (i < stops.length - 2 && stops[i + 1].arrival <= seconds) i++;
  const here = stops[i], next = stops[i + 1];
  const travel = next.arrival - here.departure;
  const dwell = train ? 0 : here.departure > here.arrival ? 0 : Math.min(busDwell, travel * 0.3);
  const leave = here.departure + dwell;
  if (seconds < leave) return here.distance;
  return here.distance + (next.distance - here.distance) * ease(Math.min(1, (seconds - leave) / Math.max(1, next.arrival - leave)));
}

export function createTransit(data, routes, project, elevation, mapScale) {
  const roadGrid = segmentGrid(routes, route => route.kind !== 'rail' && route.size >= 3.5);
  const railGrid = segmentGrid(routes, route => route.kind === 'rail');
  const kinds = data.routes.map(([name, title, colour, text, type]) => ({ name, title, colour, text, train: type === 2 }));
  const shapeTrains = new Set(data.trips.filter(trip => kinds[trip[0]].train).map(trip => trip[2]));
  const paths = data.shapes.map((flat, index) => {
    const line = [];
    for (let i = 0; i < flat.length; i += 3) line.push([...project(flat[i], flat[i + 1]), flat[i + 2]]);
    const train = shapeTrains.has(index);
    return buildPath(line, train ? railGrid : roadGrid, elevation, train ? 7 : 8, train);
  });
  const freight = data.freight.map((flat, index) => {
    const line = [];
    let travelled = 0;
    for (let i = 0; i < flat.length; i += 2) {
      const [x, y] = project(flat[i], flat[i + 1]);
      if (line.length) travelled += Math.hypot(x - line.at(-1)[0], y - line.at(-1)[1]);
      line.push([x, y, travelled]);
    }
    return { index, path: buildPath(line, railGrid, elevation, 6, true), length: travelled };
  });
  return {
    kinds, paths, freight, mapScale,
    trips: data.trips.map(trip => decode(trip, data.text)),
    services: data.services,
    vehicles: new Map(), active: [], checkedAt: -Infinity, touched: [], time: undefined,
  };
}

function refreshActive(transit, ms) {
  const today = serviceDay(ms), yesterday = serviceDay(ms - 86400000);
  const active = [];
  transit.trips.forEach((trip, index) => {
    const service = transit.services[trip.service];
    for (const [day, seconds] of [[today, today.seconds], [yesterday, today.seconds + 86400]]) {
      if (!runs(service, day)) continue;
      const { stops } = trip;
      if (seconds < stops[0].arrival - layover || seconds > stops.at(-1).departure + 30) continue;
      active.push({ index, offset: seconds - today.seconds });
      break;
    }
  });
  transit.active = active;
  transit.seconds = today.seconds;
  transit.checkedAt = ms;
}

export function advanceTransit(transit, traffic, time, ms, instant = false) {
  const gap = transit.time === undefined ? 0 : Math.max(0, time - transit.time);
  const step = Math.min(0.25, gap);
  transit.time = time;
  if (Math.abs(ms - transit.checkedAt) > 5000) refreshActive(transit, ms);
  const seconds = transit.seconds + (ms - transit.checkedAt) / 1000;
  for (const lane of transit.touched) lane.obstacles.length = 0;
  transit.touched = [];
  const live = new Set();
  for (const { index, offset } of transit.active) {
    const trip = transit.trips[index];
    const kind = transit.kinds[trip.route];
    const path = transit.paths[trip.shape];
    const goal = target(trip, seconds + offset, kind.train);
    if (goal === null || !path.count) continue;
    live.add(index);
    let vehicle = transit.vehicles.get(index);
    if (!vehicle) {
      vehicle = { trip, kind, path, progress: goal, speed: 0, boarded: null, index, offset };
      transit.vehicles.set(index, vehicle);
    }
    if (instant || Math.abs(goal - vehicle.progress) > 400 || !step) {
      vehicle.speed = gap > 0 ? Math.min(30, Math.max(0, goal - vehicle.progress) / gap) : vehicle.speed;
      vehicle.progress = goal;
      continue;
    }
    const sample = Math.round(indexAt(path, vehicle.progress));
    const ahead = Math.min(path.count - 1, sample + 1);
    const pixelsPerMetre = Math.max(0.2, spacing / Math.max(0.5, path.ds[ahead] - path.ds[Math.max(0, ahead - 1)]));
    const behind = goal - vehicle.progress;
    let desired = behind <= 0.3 ? 0 : Math.min(kind.train ? 30 : 17, behind * 0.9 + 0.6);
    const route = path.routes[sample];
    const road = !kind.train && route && traffic.roadByRoute.get(route);
    let laneAlong = 0, direction = 1;
    if (road) {
      const along = path.alongs[sample] * road.distance / Math.max(1, route.flatDistance);
      direction = path.forward[sample] ? 1 : -1;
      laneAlong = direction > 0 ? along : road.distance - along;
      const limit = roadLimit(road, direction, laneAlong, busLength * transit.mapScale, vehicle.speed * pixelsPerMetre, time);
      desired = Math.min(desired, limit / pixelsPerMetre);
      const lane = road.lanes?.get(direction);
      if (lane) {
        lane.obstacles.push({ along: laneAlong, length: busLength * transit.mapScale });
        transit.touched.push(lane);
      }
    }
    vehicle.speed = desired < vehicle.speed ? desired : Math.min(desired, vehicle.speed + (kind.train ? 0.8 : 2.2) * step);
    vehicle.progress += vehicle.speed * step;
    if (!kind.train && vehicle.speed < 0.3 && behind < 3) {
      const { x, y } = pose(path, indexAt(path, vehicle.progress));
      const stop = traffic.stops.find(({ point }) => Math.abs(point[0] - x) < 12 && Math.abs(point[1] - y) < 12);
      if (stop && vehicle.boarded !== stop) {
        vehicle.boarded = stop;
        board(stop, time);
      }
    }
  }
  for (const index of transit.vehicles.keys()) if (!live.has(index)) transit.vehicles.delete(index);
}

function drawCar(ctx, x, y, dx, dy, length, body, stripe, roof) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = '#34494470';
  ctx.fillRect(0, 0, Math.max(3, Math.abs(dx) * length + 1), 1);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.fillStyle = '#2f3b40';
  ctx.fillRect(-length / 2, -0.4, length, 2.9);
  ctx.fillStyle = body;
  ctx.fillRect(-length / 2, -1.6, length, 2.8);
  if (stripe) {
    ctx.fillStyle = stripe;
    ctx.fillRect(-length / 2, -0.1, length, 0.75);
  }
  if (roof) {
    ctx.fillStyle = roof;
    ctx.fillRect(-length / 2 + 0.6, -1.4, length - 1.2, 0.7);
  }
  ctx.restore();
}

const inside = (bounds, x, y, pad) =>
  x >= bounds.left - pad && x <= bounds.right + pad && y >= bounds.top - pad && y <= bounds.bottom + pad;

function paintTrain(ctx, path, head, forward, cars, bounds, lights, beam) {
  let offset = 0;
  for (const car of cars) {
    const centre = head - (offset + car.length / 2) * (forward ? 1 : -1) / spacing;
    offset += car.length + carriage.gap;
    if (centre < 0 || centre > path.count - 1) continue;
    const { x, y, dx, dy, hidden } = pose(path, centre);
    if (hidden || !inside(bounds, x, y, 12)) continue;
    const sx = forward ? dx : -dx, sy = forward ? dy : -dy;
    if (lights) {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(Math.atan2(sy, sx));
      if (car.lead) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = lights;
        ctx.drawImage(beam, car.length / 2 - 1, -4.5, 18, 9);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (car.windows) {
        ctx.fillStyle = '#ffe3a0';
        ctx.fillRect(-car.length / 2 + 1, -1.2, car.length - 2, 0.6);
      }
      ctx.restore();
      continue;
    }
    drawCar(ctx, x, y, sx, sy, car.length, car.body, car.stripe, car.roof);
    if (car.lead) {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(Math.atan2(sy, sx));
      ctx.fillStyle = '#ffe5a9';
      ctx.fillRect(car.length / 2 - 0.6, -1.4, 0.6, 2.4);
      ctx.restore();
    }
    if (car.load) {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(Math.atan2(sy, sx));
      ctx.fillStyle = car.load;
      ctx.fillRect(-car.length / 2 + 0.5, -2.4, car.length - 1, 1.6);
      ctx.restore();
    }
  }
}

const teHuia = [
  { length: carriage.loco, body: '#f2c14e', stripe: '#1d1d1d', roof: '#3a3a3a', lead: true },
  ...Array.from({ length: 5 }, () => ({ length: carriage.coach, body: '#1f2326', stripe: '#e9e4d6', roof: '#4b5157', windows: true })),
];

function freightConsist(line, slot) {
  const locos = hash(line, slot * 7 + 1) < 0.35 ? 2 : 1;
  const wagons = 14 + Math.floor(hash(line, slot * 7 + 2) * 18);
  const cargo = hash(line, slot * 7 + 3);
  const cars = Array.from({ length: locos }, (_, i) => ({
    length: carriage.loco, body: '#3b3f44', stripe: '#d8453a', roof: '#f2c14e', lead: i === 0,
  }));
  for (let i = 0; i < wagons; i++) {
    const pick = hash(line * 1000 + i, slot);
    if (cargo < 0.45) cars.push({ length: carriage.wagon, body: '#4a4d50', load: containers[Math.floor(pick * containers.length)] });
    else if (cargo < 0.75) cars.push({ length: carriage.wagon, body: '#4a4d50', load: pick < 0.85 ? '#8a6a44' : null });
    else cars.push({ length: carriage.wagon, body: '#d9dcd8', stripe: '#9aa3a8' });
  }
  return cars;
}

function freightTrains(transit, ms) {
  const clock = ms / 1000;
  const trains = [];
  for (const { index, path, length } of transit.freight) {
    for (let slot = Math.floor(clock / freightSlot) - 2; slot <= Math.floor(clock / freightSlot); slot++) {
      if (hash(index + 31, slot) > 0.55) continue;
      const departure = slot * freightSlot + hash(index + 37, slot) * freightSlot * 0.6;
      const travelled = (clock - departure) * freightSpeed;
      const cars = freightConsist(index, slot);
      const consist = cars.reduce((sum, car) => sum + car.length + carriage.gap, 0);
      if (travelled < 0 || travelled > length + consist) continue;
      const forward = hash(index + 41, slot) < 0.5;
      const head = (forward ? travelled : length - travelled) / spacing;
      trains.push({ path, head, forward, cars });
    }
  }
  return trains;
}

function placeVehicle(transit, vehicle) {
  const index = indexAt(vehicle.path, vehicle.progress);
  const { x, y, dx, dy } = pose(vehicle.path, index);
  if (vehicle.kind.train) return { x, y, dx, dy, index };
  const route = vehicle.path.routes[Math.round(index)];
  const kerb = (route ? route.size : 9) * 0.21 * transit.mapScale;
  return { x: x + dy * kerb, y: y - dx * kerb, dx, dy, index };
}

export function describeVehicle(transit, key) {
  const vehicle = transit.vehicles.get(key);
  if (!vehicle) return null;
  const { x, y } = placeVehicle(transit, vehicle);
  const { kind, trip } = vehicle;
  const next = trip.stops.find(stop => stop.distance > vehicle.progress + 4) ?? trip.stops.at(-1);
  return {
    key, x, y, train: kind.train, name: kind.train ? kind.title : kind.name, title: kind.title,
    colour: kind.colour, text: kind.text, headsign: trip.headsign, next: next.name,
    nextAt: next.arrival - vehicle.offset, stopped: vehicle.speed < 0.3,
  };
}

export function listVehicles(transit, inMap) {
  return [...transit.vehicles.keys()].map(key => describeVehicle(transit, key)).filter(item => inMap(item.x, item.y));
}

export function paintTransit(ctx, transit, bounds, ms, lights = 0, beam = null) {
  const scale = transit.mapScale;
  for (const vehicle of transit.vehicles.values()) {
    const { kind, path } = vehicle;
    const { x, y, dx, dy, index } = placeVehicle(transit, vehicle);
    if (kind.train) {
      paintTrain(ctx, path, index, true, teHuia, bounds, lights, beam);
      continue;
    }
    if (!inside(bounds, x, y, 8)) continue;
    const length = busLength * scale;
    if (lights) {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(Math.atan2(dy, dx));
      ctx.globalAlpha = lights;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(beam, length / 2 - 1, -4.2, 14, 8);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(length / 2 - 0.55, -1.45, 0.7, 0.7);
      ctx.fillRect(length / 2 - 0.55, 0.4, 0.7, 0.7);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(-length / 2 + 0.8, -1.3, length - 2.6, 0.6);
      ctx.fillStyle = '#c2342c';
      ctx.fillRect(-length / 2, -1.45, 0.6, 0.65);
      ctx.fillRect(-length / 2, 0.4, 0.6, 0.65);
      ctx.restore();
      continue;
    }
    drawCar(ctx, x, y, dx, dy, length, '#efe6c8', kind.colour, '#5d7f8c');
    if (vehicle.speed < 0.4) {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillStyle = '#e2483d';
      ctx.fillRect(-length / 2, -1.45, 0.6, 0.65);
      ctx.fillRect(-length / 2, 0.4, 0.6, 0.65);
      ctx.restore();
    }
  }
  for (const { path, head, forward, cars } of freightTrains(transit, ms)) {
    paintTrain(ctx, path, head, forward, cars, bounds, lights, beam);
  }
}
