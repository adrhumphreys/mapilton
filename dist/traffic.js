import { hash, locate, measure, nearest } from './paths.js?life=3';
import { paintPerson } from './people.js?life=3';

const signalCycle = 34;
const braking = 8;
const hardBraking = 15;
const acceleration = 3.5;
const lookahead = 50;

function lightFor(controller, group, time) {
  const t = ((time + controller.offset) % signalCycle + signalCycle) % signalCycle;
  const local = group ? (t + signalCycle / 2) % signalCycle : t;
  return local < 13 ? 'green' : local < 16 ? 'amber' : 'red';
}

function crossingState(crossing, time) {
  const t = time + crossing.offset;
  const round = Math.floor(t / crossing.period);
  const local = t - round * crossing.period;
  return {
    round,
    local,
    walking: hash(crossing.id, round) < crossing.busy && local < crossing.duration,
    arriving: hash(crossing.id, round + 1) < crossing.busy && local > crossing.period - 1.2,
  };
}

function approachGroup(controller, dx, dy) {
  const angle = Math.atan2(dy, dx);
  controller.axis ??= angle;
  return Math.abs(Math.cos(angle - controller.axis)) > Math.SQRT1_2 ? 0 : 1;
}

function waitingPassengers([x, y], shelter, busy, random, outfit) {
  const chance = shelter ? busy ? 0.9 : 0.45 : busy ? 0.35 : 0.12;
  if (random() > chance) return [];
  const spots = shelter ? [[2, 1], [-2, 2], [-4, 1.5]] : [[1.5, 1]];
  const count = 1 + Math.floor(random() * (busy ? spots.length : Math.min(2, spots.length)));
  return spots.slice(0, count).map(([dx, dy]) => ({
    x: x + dx, y: y + dy, colour: outfit(), seed: random(), boardAt: Infinity, backAt: 0,
  }));
}

export function createTraffic({ routes, details, project, elevation, random, clothing, busy, mapScale, buses = true }) {
  const outfit = () => clothing[Math.floor(random() * clothing.length)];
  const controllers = [], poles = [], crossings = [], stops = [];
  details.forEach(([kind, east, south, variant], id) => {
    const point = elevation.point(project(east, south));
    if (kind === 'signal') {
      let controller = controllers.find(({ x, y }) => Math.hypot(x - point[0], y - point[1]) < 28);
      if (!controller) controllers.push(controller = { x: point[0], y: point[1], offset: random() * signalCycle });
      poles.push({ point, controller, gap: 12, group: null, visible: false });
    } else if (kind === 'crossing') {
      crossings.push({ id, point, busy: busy(point) ? 0.7 : 0.3, period: 14 + random() * 16, offset: random() * 30 });
    } else if (kind === 'bus') {
      stops.push({ point, people: waitingPassengers(point, variant, busy(point), random, outfit) });
    }
  });

  const roads = routes.filter(route => route.size >= 6 && route.kind !== 'rail')
    .map(route => ({ route, ...measure(route.points) }))
    .filter(road => road.distance >= 34);
  const near = ({ bounds: [left, top, right, bottom] }, [x, y], pad) =>
    x > left - pad && x < right + pad && y > top - pad && y < bottom + pad;

  for (const road of roads) {
    road.stops = [];
    const signalled = new Map();
    for (const pole of poles) {
      const hit = near(road, pole.point, 9) && nearest(road, pole.point, 9);
      if (!hit) continue;
      if (hit.gap < pole.gap) Object.assign(pole, { gap: hit.gap, dx: hit.dx, dy: hit.dy });
      const extent = signalled.get(pole.controller) ?? { from: Infinity, to: -Infinity, dx: hit.dx, dy: hit.dy };
      extent.from = Math.min(extent.from, hit.offset);
      extent.to = Math.max(extent.to, hit.offset);
      signalled.set(pole.controller, extent);
    }
    for (const [controller, { from, to, dx, dy }] of signalled) {
      road.stops.push({ kind: 'signal', controller, group: approachGroup(controller, dx, dy),
        forward: from - 2.5, backward: to + 2.5 });
    }
    for (const crossing of crossings) {
      const hit = near(road, crossing.point, 7) && nearest(road, crossing.point, 7);
      if (!hit) continue;
      crossing.road ??= { x: hit.x, y: hit.y, dx: hit.dx, dy: hit.dy, half: road.route.width * 0.49 };
      road.stops.push({ kind: 'crossing', crossing, forward: hit.offset - 2.6, backward: hit.offset + 2.6 });
    }
    for (const stop of stops) {
      const hit = near(road, stop.point, 10) && nearest(road, stop.point, 10);
      if (hit) road.stops.push({ kind: 'bus', stop, side: hit.side, forward: hit.offset, backward: hit.offset });
    }
  }
  for (const pole of poles) {
    if (pole.dx !== undefined) pole.group = approachGroup(pole.controller, pole.dx, pole.dy);
  }
  const zebras = crossings.filter(crossing => crossing.road);
  for (const crossing of zebras) crossing.duration = (crossing.road.half * 2 + 3) / 1.05;

  const vehicle = (road, direction, along, bus) => {
    const cruise = bus ? 6 + random() * 2 : 7 + random() * 5;
    return {
      road, direction, along, cruise, speed: cruise, bus,
      length: (bus ? 10 : road.route.size >= 8 && random() < 0.15 ? 8 : 4.5) * mapScale,
      kerb: road.route.size * 0.21 * mapScale,
      colour: bus ? '#efe6c8' : outfit(),
      stops: road.stops
        .filter(stop => stop.kind !== 'bus' || (bus && stop.side === direction))
        .map(stop => ({ stop, at: direction > 0 ? stop.forward : road.distance - stop.backward }))
        .sort((a, b) => a.at - b.at),
      served: new Set(), dwellUntil: 0, braking: false, presence: bus ? random() * 0.35 : random(), active: true,
    };
  };
  const queues = [], vehicles = [];
  for (const road of roads) {
    if (random() < 0.25) continue;
    const lanes = new Map([[1, []], [-1, []]]);
    for (let d = 0; d < road.distance; d += 70) {
      const direction = random() > 0.5 ? 1 : -1;
      lanes.get(direction).push(vehicle(road, direction, (d + random() * 70) % road.distance, false));
    }
    road.lanes = lanes;
    if (buses && road.stops.some(stop => stop.kind === 'bus') && random() < 0.6) {
      const direction = random() > 0.5 ? 1 : -1;
      lanes.get(direction).push(vehicle(road, direction, random() * road.distance, true));
    }
    for (const lane of lanes.values()) {
      lane.obstacles = [];
      if (!lane.length) continue;
      queues.push(lane);
      vehicles.push(...lane);
    }
  }
  return { queues, vehicles, poles, zebras, stops: stops.filter(stop => stop.people.length), clothing, activity: 1,
    roadByRoute: new Map(roads.map(road => [road.route, road])) };
}

const safeSpeed = room => room < 0.25 ? 0 : Math.sqrt(2 * braking * room);

export function board(stop, time) {
  const waiting = stop.people.filter(person => time >= person.backAt);
  waiting.forEach((person, index) => {
    person.boardAt = time + 0.8 + index * 0.9;
    person.backAt = person.boardAt + 30 + person.seed * 50;
  });
  return 4 + waiting.length * 0.9;
}

function holds(stop, car, gap, time) {
  const committed = car.speed * car.speed > 2 * hardBraking * Math.max(gap, 0.01);
  if (stop.kind === 'signal') return !committed && lightFor(stop.controller, stop.group, time) !== 'green';
  if (stop.kind === 'crossing') {
    const { walking, arriving } = crossingState(stop.crossing, time);
    return (walking || arriving) && !committed;
  }
  if (car.served.has(stop)) return false;
  if (gap < 0.8 && car.speed < 0.05) {
    car.served.add(stop);
    car.dwellUntil = time + board(stop.stop, time);
  }
  return true;
}

export function advanceTraffic(traffic, time) {
  const step = traffic.time === undefined ? 0 : Math.min(0.1, Math.max(0, time - traffic.time));
  traffic.time = time;
  if (traffic.started === undefined) {
    traffic.started = true;
    for (const car of traffic.vehicles) car.active = car.presence < traffic.activity;
  }
  if (!step) return;
  for (const queue of traffic.queues) {
    queue.sort((a, b) => a.along - b.along);
    let leader;
    for (let index = queue.length - 1; index >= 0; index--) {
      const car = queue[index];
      if (!car.active) {
        car.along += car.cruise * step;
        if (car.along >= car.road.distance) {
          car.along -= car.road.distance;
          car.active = car.presence < traffic.activity;
          car.speed = car.cruise;
        }
        continue;
      }
      let limit = car.cruise;
      if (leader) limit = Math.min(limit, safeSpeed(leader.along - car.along - (leader.length + car.length) / 2 - 1.4));
      for (const obstacle of queue.obstacles) {
        if (obstacle.along <= car.along) continue;
        limit = Math.min(limit, safeSpeed(obstacle.along - car.along - (obstacle.length + car.length) / 2 - 1.4));
      }
      if (time < car.dwellUntil) limit = 0;
      else {
        for (const { at, stop } of car.stops) {
          const gap = at - car.along - car.length / 2;
          if (gap < -0.5) continue;
          if (gap > lookahead) break;
          if (!holds(stop, car, gap, time)) continue;
          limit = Math.min(limit, safeSpeed(gap));
          break;
        }
      }
      car.braking = limit < car.speed - 0.05 || car.speed < 0.3;
      car.speed = limit < car.speed ? limit : Math.min(limit, car.speed + acceleration * step);
      car.along += car.speed * step;
      if (car.along >= car.road.distance) {
        car.along -= car.road.distance;
        car.served.clear();
        car.active = car.presence < traffic.activity;
        leader = undefined;
      } else leader = car;
    }
  }
}

export function roadLimit(road, direction, along, length, speed, time) {
  let limit = Infinity;
  for (const car of road.lanes?.get(direction) ?? []) {
    if (!car.active || car.along <= along) continue;
    limit = Math.min(limit, safeSpeed(car.along - along - (car.length + length) / 2 - 1.4));
  }
  const committed = gap => speed * speed > 2 * hardBraking * Math.max(gap, 0.01);
  for (const stop of road.stops) {
    if (stop.kind === 'bus') continue;
    const at = direction > 0 ? stop.forward : road.distance - stop.backward;
    const gap = at - along - length / 2;
    if (gap < -0.5 || gap > lookahead || committed(gap)) continue;
    const blocked = stop.kind === 'signal' ? lightFor(stop.controller, stop.group, time) !== 'green'
      : (({ walking, arriving }) => walking || arriving)(crossingState(stop.crossing, time));
    if (blocked) limit = Math.min(limit, safeSpeed(gap));
  }
  return limit;
}

const inside = (bounds, x, y, pad = 0) =>
  x >= bounds.left - pad && x <= bounds.right + pad && y >= bounds.top - pad && y <= bounds.bottom + pad;

function placeVehicle(car, bounds) {
  const { road, direction, along, kerb, active } = car;
  if (!active) return null;
  const [left, top, right, bottom] = road.bounds;
  if (right + 5 < bounds.left || left - 5 > bounds.right || bottom + 5 < bounds.top || top - 5 > bounds.bottom) return null;
  const [px, py, sx, sy] = locate(road, direction > 0 ? along : road.distance - along);
  const dx = sx * direction, dy = sy * direction;
  const x = px + dy * kerb, y = py - dx * kerb;
  if (!inside(bounds, x, y)) return null;
  return { x, y, dx, dy, fade: Math.min(1, along / 4, (road.distance - along) / 4) };
}

function paintVehicle(ctx, car, bounds) {
  const { length, bus, colour, braking } = car;
  const placed = placeVehicle(car, bounds);
  if (!placed) return;
  const { x, y, dx, dy, fade } = placed;
  ctx.globalAlpha = fade;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = '#34494485';
  ctx.fillRect(0, 0, bus ? 7 : 5, 1);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.fillStyle = '#394951';
  ctx.fillRect(-length / 2, -0.5, length + 0.5, 2.8);
  ctx.fillStyle = colour;
  ctx.fillRect(-length / 2, -1.5, length, 2.6);
  if (bus) {
    ctx.fillStyle = '#478f65';
    ctx.fillRect(-length / 2, -0.15, length, 0.7);
    ctx.fillStyle = '#5d7f8c';
    ctx.fillRect(-length / 2 + 0.8, -1.3, length - 2.6, 0.6);
  }
  ctx.fillStyle = '#839caa';
  ctx.fillRect(length / 2 - 1.6, -1.4, 0.9, 2);
  ctx.fillStyle = '#ffe5a9';
  ctx.fillRect(length / 2 - 0.55, -1.45, 0.55, 0.65);
  if (braking) {
    ctx.fillStyle = '#e2483d';
    ctx.fillRect(-length / 2, -1.45, 0.6, 0.65);
    ctx.fillRect(-length / 2, 0.4, 0.6, 0.65);
  }
  ctx.restore();
}

export function paintTraffic(ctx, traffic, time, bounds) {
  for (const { point: [sx, sy], people } of traffic.stops) {
    if (!inside(bounds, sx, sy, 6)) continue;
    for (const person of people) {
      if (time >= person.boardAt && time < person.backAt) continue;
      let { x, y } = person;
      const leaving = person.boardAt - time;
      if (leaving > 0 && leaving < 0.8) {
        const t = 1 - leaving / 0.8;
        x += (sx - x) * t;
        y += (sy + 1 - y) * t;
      }
      ctx.globalAlpha = time >= person.backAt ? Math.min(1, (time - person.backAt) / 1.5) : 1;
      const beat = Math.floor(time / 4 + person.seed * 9);
      paintPerson(ctx, x, y, person.colour, leaving > 0 && leaving < 0.8 && Math.sin(time * 11) > 0 ? -1 : 0,
        hash(person.seed * 1e6, beat) < 0.5 ? 1 : -1);
    }
  }
  ctx.globalAlpha = 1;
  for (const crossing of traffic.zebras) {
    const { x, y, dx, dy, half } = crossing.road;
    if (!inside(bounds, x, y, 6)) continue;
    const { walking, round, local } = crossingState(crossing, time);
    if (!walking) continue;
    const side = hash(crossing.id, round * 3 + 1) < 0.5 ? 1 : -1;
    const offset = (local / crossing.duration * 2 - 1) * (half + 1.5) * side;
    const colour = traffic.clothing[Math.floor(hash(crossing.id, round * 3 + 2) * traffic.clothing.length)];
    paintPerson(ctx, x - dy * offset, y + dx * offset, colour, Math.sin(time * 11 + crossing.id) > 0 ? -1 : 0, side);
  }
  for (const car of traffic.vehicles) paintVehicle(ctx, car, bounds);
  ctx.globalAlpha = 1;
}

export function revealSignals(traffic, pixel) {
  for (const pole of traffic.poles) {
    const [r, g, b, a] = pixel(Math.round(pole.point[0]), Math.round(pole.point[1]) - 4);
    pole.visible = a > 150 && Math.abs(r - 59) < 14 && Math.abs(g - 71) < 14 && Math.abs(b - 64) < 14;
  }
}

export function paintSignals(ctx, traffic, time, bounds) {
  for (const { point, controller, group, visible } of traffic.poles) {
    if (!visible || group === null) continue;
    const x = Math.round(point[0]), y = Math.round(point[1]);
    if (!inside(bounds, x, y)) continue;
    const light = lightFor(controller, group, time);
    ctx.fillStyle = light === 'green' ? '#7be08a' : light === 'amber' ? '#f2b84b' : '#f0533f';
    ctx.fillRect(x - 0.35, y - (light === 'red' ? 4.7 : light === 'amber' ? 3.9 : 3.1), 0.95, 0.75);
  }
}

export function paintVehicleLights(ctx, traffic, bounds, strength, beam) {
  if (strength <= 0) return;
  for (const car of traffic.vehicles) {
    const placed = placeVehicle(car, bounds);
    if (!placed) continue;
    const { x, y, dx, dy, fade } = placed;
    const half = car.length / 2;
    ctx.globalAlpha = fade * strength;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(Math.atan2(dy, dx));
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(beam, half - 1, -4.2, 14, 8);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff6d8';
    ctx.fillRect(half - 0.55, -1.45, 0.7, 0.7);
    ctx.fillRect(half - 0.55, 0.4, 0.7, 0.7);
    ctx.fillStyle = car.braking ? '#ff4a3a' : '#c2342c';
    ctx.fillRect(-half, -1.45, 0.6, 0.65);
    ctx.fillRect(-half, 0.4, 0.6, 0.65);
    if (car.bus) {
      ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(-half + 0.8, -1.3, car.length - 2.6, 0.6);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
