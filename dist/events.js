import { measure, locate, hash } from './paths.js?life=3';
import { paintPerson } from './people.js?life=3';

const courseEdge = [[-3602,-2556],[-3618,-2569],[-3633,-2584],[-3646,-2603],[-3651,-2612],[-3820,-2993],[-3828,-3020],[-3829,-3053],[-3825,-3077],[-3812,-3112],[-3793,-3141],[-3776,-3157],[-3756,-3170],[-3726,-3183],[-3696,-3189],[-3668,-3188],[-3644,-3184],[-3619,-3178],[-3603,-3168],[-3585,-3154],[-3568,-3135],[-3554,-3113],[-3384,-2735],[-3377,-2706],[-3374,-2677],[-3374,-2659],[-3379,-2639],[-3390,-2612],[-3399,-2595],[-3411,-2578],[-3430,-2562],[-3450,-2549],[-3471,-2540],[-3494,-2533],[-3516,-2530],[-3540,-2532],[-3566,-2537],[-3584,-2546]];
const grandstand = [-3340, -2827];
const rail = 38;
const day = 86400;
const meetingDays = new Set([3, 6]);
const trialDays = new Set([1, 2, 4]);
const coats = ['#7a4a2b', '#a0562c', '#5a3a24', '#2e2622', '#b8b2a6', '#8a5a33', '#6b4026'];
const silks = [
  ['#d8453a', '#f2c14e'], ['#2f6fb0', '#ffffff'], ['#3f9b6a', '#f29b38'], ['#8c4fa3', '#f4d35e'],
  ['#f08a8a', '#1f4e79'], ['#1f4e79', '#d8453a'], ['#f4d35e', '#2a2a2a'], ['#ffffff', '#3f9b6a'],
  ['#41b3a3', '#8c4fa3'], ['#e45f3c', '#2f6fb0'], ['#2a2a2a', '#f08a8a'], ['#f29b38', '#1f4e79'],
];
const kits = [
  ['#d8453a', '#f3ecd8'], ['#2f6fb0', '#f3ecd8'], ['#f4d35e', '#2a2a2a'], ['#3f9b6a', '#f3ecd8'],
  ['#2a2a2a', '#f3ecd8'], ['#8c4fa3', '#f4d35e'], ['#f3ecd8', '#1f4e79'], ['#e45f3c', '#1f4e79'],
];
const outfits = ['#c44d3f', '#3a6679', '#e3c75a', '#5d8a4f', '#f0ece0', '#7c5c9a', '#2f3e57', '#d98c5f', '#9fb7c9'];

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = value => value * value * (3 - 2 * value);
const wrap = (value, length) => ((value % length) + length) % length;

function signedArea(points) {
  let total = 0;
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    total += a[0] * b[1] - b[0] * a[1];
  });
  return total / 2;
}

function createCourse(project, elevation) {
  const anticlockwise = signedArea(courseEdge) > 0 ? [...courseEdge].reverse() : courseEdge;
  const loop = measure([...anticlockwise, anticlockwise[0]]);
  const spot = (s, lane) => {
    const [x, y, dx, dy] = locate(loop, wrap(s, loop.distance));
    const inside = rail - lane;
    return { point: elevation.point(project(x + dy * inside, y - dx * inside)), dx, dy };
  };
  let finish = 0, closest = Infinity;
  for (let s = 0; s < loop.distance; s += 2) {
    const [x, y] = locate(loop, s);
    const gap = Math.hypot(x - grandstand[0], y - grandstand[1]);
    if (gap < closest) closest = gap, finish = s;
  }
  const xs = [], ys = [];
  for (let s = 0; s < loop.distance; s += 20) {
    const [x, y] = spot(s, rail + 10).point;
    xs.push(x);
    ys.push(y);
  }
  const bounds = [Math.min(...xs) - 30, Math.min(...ys) - 30, Math.max(...xs) + 30, Math.max(...ys) + 30];
  const crowd = [];
  for (let i = 0; i < 170; i++) {
    const along = finish - 70 + hash(i, 811) * 120;
    const back = rail + 4 + hash(i, 813) ** 1.6 * 13;
    crowd.push({ s: along, lane: back, seed: hash(i, 815), colour: outfits[Math.floor(hash(i, 817) * outfits.length)], id: i });
  }
  crowd.forEach(person => {
    const { point } = spot(person.s, person.lane);
    person.x = point[0];
    person.y = point[1];
  });
  crowd.sort((a, b) => a.y - b.y);
  const marquees = [[finish - 95, rail + 9], [finish - 108, rail + 15], [finish + 62, rail + 10]]
    .map(([s, lane]) => spot(s, lane).point);
  return { loop, spot, finish, bounds, crowd, marquees };
}

function rectangle(ring) {
  let best = null;
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[i + 1];
    const length = Math.hypot(bx - ax, by - ay);
    if (length < 1) continue;
    const ux = (bx - ax) / length, uy = (by - ay) / length;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of ring) {
      const u = x * ux + y * uy, v = -x * uy + y * ux;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u);
      v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const size = (u1 - u0) * (v1 - v0);
    if (!best || size < best.size) best = { size, ux, uy, u0, u1, v0, v1 };
  }
  if (!best) return null;
  const { ux, uy, u0, u1, v0, v1 } = best;
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  const centre = [cu * ux - cv * uy, cu * uy + cv * ux];
  const long = u1 - u0 >= v1 - v0;
  return {
    centre,
    axis: long ? [ux, uy] : [-uy, ux],
    half: long ? [(u1 - u0) / 2, (v1 - v0) / 2] : [(v1 - v0) / 2, (u1 - u0) / 2],
    fill: Math.abs(signedArea(ring)) / best.size,
  };
}

function createVenues(areas, project, elevation) {
  const venues = [];
  areas.forEach(([kind, rings], id) => {
    if (kind !== 'pitch') return;
    const box = rectangle(rings[0]);
    if (!box || box.fill < 0.8) return;
    const [length, breadth] = box.half.map(value => value * 2);
    const tennis = length >= 18 && length <= 45 && breadth >= 8 && breadth <= 22;
    const field = length >= 55 && length <= 150 && breadth >= 30 && breadth <= 100;
    if (!tennis && !field) return;
    const [cx, cy] = box.centre, [ax, ay] = box.axis;
    const place = (u, v) => {
      const east = cx + ax * u * box.half[0] - ay * v * box.half[1];
      const south = cy + ay * u * box.half[0] + ax * v * box.half[1];
      return elevation.point(project(east, south));
    };
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => place(u, v));
    const xs = corners.map(([x]) => x), ys = corners.map(([, y]) => y);
    venues.push({
      id, tennis, place, size: length,
      bounds: [Math.min(...xs) - 8, Math.min(...ys) - 10, Math.max(...xs) + 8, Math.max(...ys) + 4],
      players: tennis ? 0 : clamp(Math.round(length / 16), 4, 7),
    });
  });
  return venues;
}

export function createEvents(areas, project, elevation) {
  return { course: createCourse(project, elevation), venues: createVenues(areas, project, elevation) };
}

function localTime(clock, sky) {
  const local = clock + (sky.utcOffset ?? 46800);
  return { seconds: wrap(local, day), weekday: wrap(Math.floor(local / day) + 4, 7), dayNumber: Math.floor(local / day) };
}

function visible([left, top, right, bottom], bounds) {
  return right >= bounds.left && left <= bounds.right && bottom >= bounds.top && top <= bounds.bottom;
}

function paintHorse(ctx, x, y, horse, facing, frame, rider) {
  x = Math.round(x);
  y = Math.round(y);
  const rect = (dx, dy, w, h) => ctx.fillRect(facing > 0 ? x + dx : x - dx - w + 1, y + dy, w, h);
  ctx.fillStyle = '#3449446b';
  ctx.fillRect(x - 3, y, 7, 1);
  ctx.fillStyle = '#2b211b';
  if (frame === 0) { rect(-2, -1, 1, 1); rect(2, -1, 1, 1); }
  else if (frame === 1) { rect(-3, -1, 1, 1); rect(3, -1, 1, 1); }
  else { rect(-1, -1, 1, 1); rect(1, -1, 1, 1); }
  rect(-3, -3, 1, 2);
  ctx.fillStyle = horse.coat;
  rect(-2, -3, 5, 2);
  rect(3, -4, 1, 2);
  rect(4, -4, 1, 1);
  if (!rider) return;
  ctx.fillStyle = rider.body;
  if (rider.crouch) { rect(0, -4, 2, 1); rect(1, -5, 1, 1); }
  else rect(0, -5, 1, 2);
  ctx.fillStyle = rider.cap;
  rect(rider.crouch ? 2 : 0, -6, 1, 1);
}

function meetingCard(local, sky) {
  const { seconds, weekday, dayNumber } = local;
  if (meetingDays.has(weekday) && seconds >= 39600 && seconds < 63000) {
    const slot = Math.floor((seconds - 43200) / 1800);
    if (slot < 0 || slot > 9) return { crowd: 1, race: null };
    return { crowd: 1, race: { seed: dayNumber * 16 + slot, offset: seconds - 43200 - slot * 1800, runners: 8 + Math.floor(hash(dayNumber, slot) * 5), trial: false } };
  }
  if (trialDays.has(weekday) && seconds >= 36000 && seconds < 54000) {
    const slot = Math.floor((seconds - 36000) / 1500);
    return { crowd: 0.08, race: { seed: dayNumber * 16 + slot, offset: seconds - 36000 - slot * 1500, runners: 5 + Math.floor(hash(dayNumber, slot) * 3), trial: true } };
  }
  return { crowd: 0, race: null, trackwork: weekday !== 0 && seconds >= 19800 && seconds < 34200 && sky.altitude > -8 };
}

function racePlan(course, race) {
  const distance = [1200, 1400, 1600, 2000, 2100][Math.floor(hash(race.seed, 3) * 5)] - (race.trial ? 200 : 0);
  const start = course.finish - distance;
  const back = wrap(course.finish - start, course.loop.distance);
  const runners = [];
  for (let i = 0; i < race.runners; i++) {
    const pick = Math.floor(hash(race.seed * 31 + i, 5) * silks.length);
    runners.push({
      coat: coats[Math.floor(hash(race.seed * 31 + i, 7) * coats.length)],
      colours: race.trial ? ['#e8e4d8', '#3a4a5a'] : silks[(pick + i) % silks.length],
      speed: 16.1 + hash(race.seed * 31 + i, 9) * 1.4,
      surge: hash(race.seed * 31 + i, 11) * Math.PI * 2,
      lane: 1 + i * 1.25,
      settle: 1 + (i % 4) * 1.4 + hash(race.seed * 31 + i, 13) * 1.2,
    });
  }
  return { distance, start, back, runners };
}

function runnerState(course, plan, runner, index, offset, time) {
  const parade = 300, depart = parade + index * 10, gathered = 780, jump = 900;
  if (offset < parade) return null;
  if (offset < gathered) {
    const waiting = course.finish + 12 - index * 7;
    const journey = wrap(waiting - (plan.start - 4), course.loop.distance);
    const progress = smooth(clamp((offset - depart) / 380, 0, 1));
    const moving = progress > 0 && progress < 1;
    return {
      s: waiting - journey * progress,
      lane: progress >= 1 ? runner.lane : 7 + (index % 2) * 2,
      facing: -1,
      gait: moving ? (journey / 380 > 1.6 ? 'canter' : 'walk') : 'stand',
      alpha: clamp((offset - parade) / 6, 0, 1),
      crouch: false,
    };
  }
  if (offset < jump) {
    return { s: plan.start - 4, lane: runner.lane, facing: 1, gait: 'stand', alpha: 1, crouch: false };
  }
  const run = offset - jump;
  const ease = runner.speed * (run - 2.2 * (1 - Math.exp(-run / 2.2)));
  const raw = ease + 5 * Math.sin(run * 0.045 + runner.surge) * Math.min(1, run / 12) - 5 * Math.sin(runner.surge);
  const covered = raw < plan.distance ? raw : plan.distance + 170 * (1 - Math.exp(-(raw - plan.distance) / 170));
  const settle = clamp(run / 14, 0, 1);
  const lane = runner.lane + (runner.settle - runner.lane) * settle + Math.sin(run * 0.05 + runner.surge) * 0.6;
  const after = raw - plan.distance;
  const alpha = after > 0 ? clamp(1 - (after - 900) / 60, 0, 1) : 1;
  if (alpha <= 0) return null;
  return { s: plan.start + covered, lane, facing: 1, gait: after > 400 ? 'canter' : 'gallop', alpha, crouch: after < 200, racing: raw < plan.distance };
}

function stride(gait, time, seed) {
  if (gait === 'stand') return 2;
  const rate = gait === 'gallop' ? 9 : gait === 'canter' ? 6 : 3.5;
  return Math.floor(time * rate + seed * 3) % 2;
}

function screenFacing(course, s, facing) {
  const a = course.spot(s, rail).point, b = course.spot(s + 3, rail).point;
  return Math.sign(b[0] - a[0]) * facing || facing;
}

function paintGates(ctx, course, plan, runners, alpha) {
  ctx.globalAlpha = alpha;
  const a = course.spot(plan.start, 0.2).point, b = course.spot(plan.start, runners * 1.25 + 0.6).point;
  ctx.strokeStyle = '#4c524f';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1] - 0.5);
  ctx.lineTo(b[0], b[1] - 0.5);
  ctx.stroke();
  ctx.strokeStyle = '#e9e4d6';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1] - 2);
  ctx.lineTo(b[0], b[1] - 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function paintMarquee(ctx, [x, y]) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = '#34494466';
  ctx.fillRect(x - 4, y, 10, 1);
  ctx.fillStyle = '#efeadc';
  ctx.fillRect(x - 4, y - 4, 9, 4);
  ctx.fillStyle = '#cfc7b4';
  ctx.fillRect(x + 3, y - 4, 2, 4);
  ctx.fillStyle = '#d8453a';
  for (let i = -4; i <= 4; i += 2) ctx.fillRect(x + i, y - 5, 1, 1);
  ctx.fillStyle = '#f6f2e6';
  ctx.fillRect(x - 3, y - 6, 7, 1);
  ctx.fillRect(x - 1, y - 7, 3, 1);
}

function paintCourse(ctx, course, sky, clock, time, bounds) {
  if (!visible(course.bounds, bounds) || sky.darkness > 0.75) return;
  const local = localTime(clock, sky);
  const card = meetingCard(local, sky);
  const race = card.race;
  const plan = race ? racePlan(course, race) : null;
  const states = plan ? plan.runners.map((runner, i) => ({ runner, i, state: runnerState(course, plan, runner, i, race.offset, time) })) : [];
  const excitement = states.some(({ state }) => state?.racing) ? 1 : 0;
  if (card.crowd > 0) {
    if (!race?.trial) course.marquees.forEach(point => paintMarquee(ctx, point));
    const turnout = card.crowd * (1 - sky.rain * 0.45) * clamp((local.seconds - 39600) / 1800, 0.15, 1);
    for (const person of course.crowd) {
      if (person.seed > turnout) continue;
      const beat = Math.floor(time * (excitement ? 4 : 0.4) + person.seed * 9);
      const cheering = excitement && hash(person.id, beat) < 0.55;
      const hop = cheering && hash(person.id, beat + 99) < 0.3 ? -1 : 0;
      const facing = excitement ? (hash(person.id, 3) < 0.8 ? -1 : 1) : hash(person.id, beat) < 0.5 ? 1 : -1;
      paintPerson(ctx, person.x, person.y + hop, person.colour, 0, facing, cheering ? (hash(person.id, beat + 5) < 0.5 ? 1 : -1) : 0,
        sky.rain > 0.15 && person.seed < 0.6 ? outfits[person.id % outfits.length] : null);
    }
  }
  if (plan) {
    const offset = race.offset;
    if (offset > 400 && offset < 935) paintGates(ctx, course, plan, plan.runners.length, clamp(Math.min((offset - 400) / 8, (935 - offset) / 15), 0, 1));
    const drawn = [];
    for (const { runner, i, state } of states) {
      if (!state) continue;
      const { point } = course.spot(state.s, state.lane);
      drawn.push({ runner, i, state, x: point[0], y: point[1] });
    }
    drawn.sort((a, b) => a.y - b.y);
    for (const { runner, i, state, x, y } of drawn) {
      if (x < bounds.left - 10 || x > bounds.right + 10 || y < bounds.top - 10 || y > bounds.bottom + 10) continue;
      ctx.globalAlpha = state.alpha;
      paintHorse(ctx, x, y, runner, screenFacing(course, state.s, state.facing), stride(state.gait, time, i * 0.37), {
        body: runner.colours[0], cap: runner.colours[1], crouch: state.crouch,
      });
    }
    ctx.globalAlpha = 1;
  }
  if (card.trackwork) {
    const session = Math.floor(local.seconds / 600);
    for (let i = 0; i < 7; i++) {
      const seed = local.dayNumber * 64 + session * 8 + i;
      if (hash(seed, 21) > 0.75) continue;
      const elapsed = local.seconds - session * 600;
      const alpha = clamp(Math.min(elapsed / 8, (600 - elapsed) / 8), 0, 1);
      const speed = 6 + hash(seed, 23) * 9;
      const s = hash(seed, 25) * course.loop.distance + elapsed * speed;
      const lane = 8 + hash(seed, 27) * 10;
      const { point } = course.spot(s, lane);
      if (point[0] < bounds.left - 10 || point[0] > bounds.right + 10 || point[1] < bounds.top - 10 || point[1] > bounds.bottom + 10) continue;
      ctx.globalAlpha = alpha;
      paintHorse(ctx, point[0], point[1], { coat: coats[Math.floor(hash(seed, 29) * coats.length)] },
        screenFacing(course, s, 1), stride(speed > 11 ? 'gallop' : 'canter', time, i * 0.29),
        { body: ['#2f3e57', '#5d8a4f', '#c44d3f', '#3a3a3a'][i % 4], cap: '#e8e4d8', crouch: speed > 11 });
    }
    ctx.globalAlpha = 1;
  }
}

function fieldBooking(local, sky) {
  const hour = local.seconds / 3600;
  if (sky.daylight < 0.5 || sky.rain > 0.5 || sky.storm) return 0;
  if (local.weekday === 6) return hour >= 8 && hour < 13 ? 0.7 : hour >= 13 && hour < 16 ? 0.25 : 0;
  if (local.weekday === 0) return hour >= 9 && hour < 15 ? 0.35 : 0;
  return hour >= 15.5 && hour < 18.75 ? 0.3 : 0;
}

function wander(t, seed) {
  const a = seed * 6.3, b = seed * 17.1, c = seed * 29.7;
  return [
    clamp(0.62 * Math.sin(t * 0.083 + a) + 0.28 * Math.sin(t * 0.197 + b) + 0.1 * Math.sin(t * 0.53 + c), -0.94, 0.94),
    clamp(0.55 * Math.sin(t * 0.121 + b) + 0.3 * Math.sin(t * 0.29 + c) + 0.1 * Math.sin(t * 0.61 + a), -0.92, 0.92),
  ];
}

function footballer(t, seed, ball, team, slot, players, rugby, half) {
  const side = team ? 1 : -1;
  if (!rugby && slot === 0) return [side * -0.9 + ball[0] * 0.06, ball[1] * 0.3];
  const rank = rugby ? slot : slot - 1, count = rugby ? players : players - 1;
  const row = rank % 2, column = Math.floor(rank / 2), columns = Math.ceil(count / 2);
  const homeU = side * -(0.8 - (column / Math.max(1, columns - 1)) * 1.3);
  const homeV = (row ? 0.45 : -0.45) + (column % 2 ? 0.15 : -0.15);
  const pull = rugby ? 0.55 : 0.34;
  let u = homeU * (1 - pull) + ball[0] * pull + 0.05 * Math.sin(t * 0.7 + slot + seed * 9);
  let v = homeV * (1 - pull * 0.8) + ball[1] * pull * 0.8 + 0.06 * Math.sin(t * 0.53 + slot * 2 + seed * 5);
  const gap = Math.hypot((u - ball[0]) * half[0], (v - ball[1]) * half[1]);
  const chase = Math.exp(-((gap / 9) ** 2)) * 0.8;
  u += (ball[0] - side * 0.03 - u) * chase;
  v += (ball[1] + (row ? 0.04 : -0.04) - v) * chase;
  return [clamp(u, -0.97, 0.97), clamp(v, -0.97, 0.97)];
}

function paintField(ctx, venue, local, sky, clock, time, booking) {
  const slotLength = 4500;
  const slot = Math.floor(local.seconds / slotLength);
  if (hash(venue.id, local.dayNumber * 32 + slot) >= booking) return;
  const elapsed = local.seconds - slot * slotLength;
  const alpha = clamp(Math.min((elapsed - 120) / 20, (slotLength - 120 - elapsed) / 20), 0, 1);
  if (alpha <= 0) return;
  const seed = hash(venue.id, local.dayNumber * 32 + slot + 7);
  const rugby = seed < 0.3;
  const kitA = kits[Math.floor(seed * 97) % kits.length];
  const kitB = kits[(Math.floor(seed * 97) + 1 + Math.floor(seed * 13) % (kits.length - 1)) % kits.length];
  const t = clock + seed * 1000;
  const ball = wander(t, seed);
  const before = wander(t - 0.3, seed);
  const half = [venue.size / 2, venue.size / 3];
  const people = [];
  for (let team = 0; team < 2; team++) {
    for (let slot = 0; slot < venue.players; slot++) {
      const [u, v] = footballer(t, seed, ball, team, slot, venue.players, rugby, half);
      const [pu] = footballer(t - 0.3, seed, before, team, slot, venue.players, rugby, half);
      const [x, y] = venue.place(u, v);
      const moving = Math.abs(u - pu) * venue.size > 0.6;
      const facing = Math.abs(u - pu) > 0.001 ? Math.sign(venue.place(u, 0)[0] - venue.place(pu, 0)[0]) || 1 : (team ? -1 : 1);
      people.push({ x, y, colour: (team ? kitB : kitA)[!rugby && slot === 0 ? 1 : 0], moving, facing, seed: team * 10 + slot });
    }
  }
  const referee = venue.place(ball[0] * 0.8 - 0.08, ball[1] * 0.7 + 0.22);
  people.push({ x: referee[0], y: referee[1], colour: '#262a2e', moving: false, facing: 1, seed: 99 });
  people.sort((a, b) => a.y - b.y);
  ctx.globalAlpha = alpha;
  for (const person of people) {
    const step = person.moving ? (Math.sin(time * 13 + person.seed) > 0 ? -1 : 0) : 0;
    paintPerson(ctx, person.x, person.y, person.colour, step, person.facing);
  }
  const [bx, by] = venue.place(...ball);
  const bounce = rugby ? 0 : Math.abs(Math.sin(t * 2.1)) * 1.5;
  ctx.fillStyle = rugby ? '#8a5a33' : '#ffffff';
  ctx.fillRect(Math.round(bx), Math.round(by - 1 - bounce), rugby ? 2 : 1, 1);
  ctx.globalAlpha = 1;
}

function paintTennis(ctx, venue, local, sky, clock, time) {
  const hour = local.seconds / 3600;
  if (hour < 7 || hour > 21 || sky.daylight < 0.5 || sky.rain > 0.05) return;
  const slotLength = 2700;
  const slot = Math.floor(local.seconds / slotLength);
  if (hash(venue.id, local.dayNumber * 64 + slot) >= sky.people * 0.4) return;
  const elapsed = local.seconds - slot * slotLength;
  const alpha = clamp(Math.min((elapsed - 60) / 10, (slotLength - 60 - elapsed) / 10), 0, 1);
  if (alpha <= 0) return;
  const doubles = hash(venue.id, local.dayNumber * 64 + slot + 3) < 0.3;
  const period = 1.35;
  const shot = Math.floor(clock / period), progress = clock / period - shot;
  const aim = k => (hash(venue.id * 7 + k, 41) - 0.5) * 1.1;
  const end = k => (k % 2 ? 0.82 : -0.82);
  const ballU = end(shot) + (end(shot + 1) - end(shot)) * progress;
  const ballV = aim(shot) + (aim(shot + 1) - aim(shot)) * progress;
  const keeper = side => {
    const own = side ? 1 : 0;
    const base = shot % 2 === own ? shot : shot - 1;
    const from = aim(base), to = aim(base + 2);
    const blend = smooth(clamp((clock / period - base) / 2, 0, 1));
    return from + (to - from) * blend;
  };
  ctx.globalAlpha = alpha;
  const colours = [outfits[venue.id % outfits.length], outfits[(venue.id * 3 + 1) % outfits.length]];
  const players = [];
  for (let side = 0; side < 2; side++) {
    const u = side ? 0.88 : -0.88, v = clamp(keeper(side), -0.8, 0.8);
    if (doubles) {
      players.push([u, clamp(v - 0.35, -0.9, 0.9), side], [u * 0.45, clamp(-v * 0.5 + 0.35, -0.9, 0.9), side]);
    } else players.push([u, v, side]);
  }
  const placed = players.map(([u, v, side]) => [...venue.place(u, v), side]).sort((a, b) => a[1] - b[1]);
  for (const [x, y, side] of placed) {
    const toward = Math.sign(venue.place(side ? -1 : 1, 0)[0] - venue.place(side ? 1 : -1, 0)[0]) || 1;
    const swing = hash(venue.id, shot) < 0.5 && Math.abs(ballU - (side ? 0.82 : -0.82)) < 0.12 ? toward : 0;
    paintPerson(ctx, x, y, colours[side], 0, toward, swing);
  }
  const [bx, by] = venue.place(ballU, ballV);
  ctx.fillStyle = '#e8f05a';
  ctx.fillRect(Math.round(bx), Math.round(by - 2 - Math.sin(progress * Math.PI) * 3), 1, 1);
  ctx.globalAlpha = 1;
}

export function paintEvents(ctx, events, sky, clock, time, bounds) {
  paintCourse(ctx, events.course, sky, clock, time, bounds);
  const local = localTime(clock, sky);
  const booking = fieldBooking(local, sky);
  for (const venue of events.venues) {
    if (!visible(venue.bounds, bounds)) continue;
    if (venue.tennis) paintTennis(ctx, venue, local, sky, clock, time);
    else if (booking > 0) paintField(ctx, venue, local, sky, clock, time, booking);
  }
}
