import { hash } from './paths.js?life=3';

const cellSize = 6;
const sampleSpacing = 6;
const currentSpeed = 1.3;

function bounds(points) {
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function polygonArea(points) {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    total += a[0] * b[1] - a[1] * b[0];
  }
  return Math.abs(total / 2);
}

function rasterise(areas) {
  const [x0, y0, x1, y1] = bounds(areas.flatMap(({ rings }) => rings.flat()));
  const left = x0 - cellSize * 2, top = y0 - cellSize * 2;
  const columns = Math.ceil((x1 - left) / cellSize) + 3;
  const rows = Math.ceil((y1 - top) / cellSize) + 3;
  const canvas = document.createElement('canvas');
  canvas.width = columns;
  canvas.height = rows;
  const paint = canvas.getContext('2d');
  paint.setTransform(1 / cellSize, 0, 0, 1 / cellSize, -left / cellSize, -top / cellSize);
  for (const { rings } of areas) {
    const shape = new Path2D();
    for (const ring of rings) {
      shape.moveTo(...ring[0]);
      for (const point of ring.slice(1)) shape.lineTo(...point);
      shape.closePath();
    }
    paint.fill(shape, 'evenodd');
  }
  const alpha = paint.getImageData(0, 0, columns, rows).data;
  const water = new Uint8Array(columns * rows);
  for (let i = 0; i < water.length; i++) water[i] = alpha[i * 4 + 3] > 127 ? 1 : 0;
  return { water, columns, rows, left, top };
}

function clearance({ water, columns, rows }) {
  const distance = new Float32Array(water.length);
  for (let i = 0; i < water.length; i++) distance[i] = water[i] ? 1e6 : 0;
  const relax = (i, j, cost) => {
    if (distance[j] + cost < distance[i]) distance[i] = distance[j] + cost;
  };
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < columns - 1; x++) {
      const i = y * columns + x;
      if (!water[i]) continue;
      relax(i, i - 1, 1);
      relax(i, i - columns, 1);
      relax(i, i - columns - 1, Math.SQRT2);
      relax(i, i - columns + 1, Math.SQRT2);
    }
  }
  for (let y = rows - 2; y > 0; y--) {
    for (let x = columns - 2; x > 0; x--) {
      const i = y * columns + x;
      if (!water[i]) continue;
      relax(i, i + 1, 1);
      relax(i, i + columns, 1);
      relax(i, i + columns + 1, Math.SQRT2);
      relax(i, i + columns - 1, Math.SQRT2);
    }
  }
  return distance;
}

function pushHeap(heap, index, priority) {
  heap.push([priority, index]);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent][0] <= heap[i][0]) break;
    [heap[parent], heap[i]] = [heap[i], heap[parent]];
    i = parent;
  }
}

function popHeap(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const a = i * 2 + 1, b = a + 1;
      let smallest = i;
      if (a < heap.length && heap[a][0] < heap[smallest][0]) smallest = a;
      if (b < heap.length && heap[b][0] < heap[smallest][0]) smallest = b;
      if (smallest === i) break;
      [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
      i = smallest;
    }
  }
  return top;
}

function centrelines(grid, distance) {
  const { water, columns, left, top } = grid;
  const steps = [1, -1, columns, -columns, columns + 1, columns - 1, 1 - columns, -1 - columns];
  const lengths = steps.map((_, k) => k < 4 ? 1 : Math.SQRT2);
  const seen = new Int32Array(water.length);
  let pass = 0;
  const sweep = from => {
    pass++;
    const order = [from];
    seen[from] = pass;
    for (let head = 0; head < order.length; head++) {
      for (const step of steps) {
        const next = order[head] + step;
        if (water[next] && seen[next] !== pass) {
          seen[next] = pass;
          order.push(next);
        }
      }
    }
    return order;
  };
  const claimed = new Uint8Array(water.length);
  const lines = [];
  for (let start = 0; start < water.length; start++) {
    if (!water[start] || claimed[start]) continue;
    const component = sweep(start);
    for (const cell of component) claimed[cell] = 1;
    if (component.length < 400) continue;
    const from = sweep(component.at(-1)).at(-1);
    const to = sweep(from).at(-1);
    const cost = new Float64Array(water.length).fill(Infinity);
    const previous = new Int32Array(water.length).fill(-1);
    const heap = [];
    cost[from] = 0;
    pushHeap(heap, from, 0);
    while (heap.length) {
      const [spent, cell] = popHeap(heap);
      if (cell === to) break;
      if (spent > cost[cell]) continue;
      steps.forEach((step, k) => {
        const next = cell + step;
        if (!water[next]) return;
        const clear = distance[next];
        const total = spent + lengths[k] * (1 + 30 / (clear * clear));
        if (total >= cost[next]) return;
        cost[next] = total;
        previous[next] = cell;
        pushHeap(heap, next, total);
      });
    }
    const cells = [];
    for (let cell = to; cell !== -1; cell = previous[cell]) cells.push(cell);
    lines.push(cells.map(cell => [
      left + (cell % columns + 0.5) * cellSize,
      top + (Math.floor(cell / columns) + 0.5) * cellSize,
      distance[cell] * cellSize,
    ]));
  }
  return lines;
}

function smooth(points, radius) {
  return points.map((_, i) => {
    const from = Math.max(0, i - radius), to = Math.min(points.length - 1, i + radius);
    const sum = [0, 0, 0];
    for (let j = from; j <= to; j++) for (let k = 0; k < 3; k++) sum[k] += points[j][k];
    return sum.map(value => value / (to - from + 1));
  });
}

function resample(points) {
  const result = [points[0]];
  let carried = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let along = sampleSpacing - carried;
    while (along <= length) {
      const t = along / length;
      result.push(a.map((value, k) => value + (b[k] - value) * t));
      along += sampleSpacing;
    }
    carried = length - (along - sampleSpacing);
  }
  return result;
}

function channel(line, project, elevation, bridges, ctx) {
  let points = resample(smooth(line, 6));
  if (points[0][1] < points.at(-1)[1]) points = points.reverse();
  const samples = points.map(([x, y, clear], i) => {
    const a = points[Math.max(0, i - 2)], b = points[Math.min(points.length - 1, i + 2)];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [sx, sy] = elevation.point(project(x, y));
    const covered = bridges.some(({ shape, width, box: [left, top, right, bottom] }) => {
      if (sx < left - 20 || sx > right + 20 || sy < top - 20 || sy > bottom + 20) return false;
      ctx.lineWidth = width + 12;
      return ctx.isPointInStroke(shape, sx, sy);
    });
    return { x, y, nx: -(b[1] - a[1]) / length, ny: (b[0] - a[0]) / length, half: clear * 0.8, sx, sy, covered };
  });
  return { samples, flecks: Math.floor(samples.length / 2.2), project, elevation };
}

function place({ samples, project, elevation }, s, f) {
  const i = Math.max(0, Math.min(samples.length - 2, Math.floor(s)));
  const t = Math.max(0, Math.min(1, s - i));
  const a = samples[i], b = samples[i + 1];
  const mix = key => a[key] + (b[key] - a[key]) * t;
  const reach = mix('half') * f;
  return elevation.point(project(mix('x') + mix('nx') * reach, mix('y') + mix('ny') * reach));
}

function fleet(river, random) {
  const count = river.samples.length;
  const metres = count * sampleSpacing;
  const boats = [];
  const add = (type, total, stretch, speed, pause, colours) => {
    for (let i = 0; i < total; i++) {
      const reach = Math.min(count - 4, stretch / sampleSpacing);
      const from = 2 + random() * (count - 4 - reach);
      boats.push({ type, from, to: from + reach, speed: speed / sampleSpacing, pause, offset: random() * 900,
        lateral: random() * 0.9 - 0.45, seed: random(), colour: colours[Math.floor(random() * colours.length)] });
    }
  };
  add('eight', Math.max(1, Math.round(metres / 4500)), 1800, 4.4, 8, ['#2c4f6b', '#7c2f3a', '#2f5c43']);
  add('kayak', Math.max(2, Math.round(metres / 1500)), 700, 1.4, 5, ['#d9643a', '#e8b13c', '#3f8fb0', '#c54c5d']);
  add('launch', Math.max(1, Math.round(metres / 6000)), Math.min(metres - 60, 4000), 4.5, 12, ['#f1ede2']);
  return boats;
}

function flocks(areas, project, elevation, ctx, random) {
  const result = [];
  for (const { shape, rings } of areas) {
    const outline = rings[0].map(point => project(...point));
    const size = polygonArea(outline);
    if (size < 400) continue;
    const [x0, y0, x1, y1] = bounds(outline);
    const groups = Math.min(7, Math.max(1, Math.round(size / 9000)));
    for (let group = 0; group < groups; group++) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const x = x0 + random() * (x1 - x0), y = y0 + random() * (y1 - y0);
        const radius = 4 + random() * Math.min(10, Math.sqrt(size) * 0.08);
        const loop = Array.from({ length: 12 }, (_, i) => [
          x + Math.cos(i * Math.PI / 6) * (radius + 3), y + Math.sin(i * Math.PI / 6) * (radius * 0.7 + 2)]);
        if (![[x, y], ...loop].every(([px, py]) => ctx.isPointInPath(shape, px, py, 'evenodd'))) continue;
        const swans = size > 60000 && group < 2;
        const brood = !swans && random() < 0.35;
        result.push({ x, y, lift: elevation.lift(x, y), radius, angle: random() * Math.PI * 2,
          speed: (0.03 + random() * 0.04) * (random() < 0.5 ? 1 : -1), swans, brood,
          members: swans ? 2 : brood ? 3 + Math.floor(random() * 3) : 2 + Math.floor(random() * 3), seed: random() });
        break;
      }
    }
  }
  return result;
}

export function createWater({ areas, project, elevation, bridges, ctx, random }) {
  const isRiver = ({ rings }) => {
    const [x0, y0, x1, y1] = bounds(rings.flat());
    return Math.hypot(x1 - x0, y1 - y0) > 1500;
  };
  const rivers = areas.filter(isRiver);
  const crossings = bridges.map(bridge => ({ ...bridge, box: bounds(bridge.points) }));
  const grid = rivers.length ? rasterise(rivers) : null;
  const channels = grid
    ? centrelines(grid, clearance(grid))
      .map(line => channel(line, project, elevation, crossings, ctx))
      .filter(({ samples }) => samples.length > 20)
    : [];
  for (const river of channels) river.boats = fleet(river, random);
  return { channels, flocks: flocks(areas.filter(area => !isRiver(area)), project, elevation, ctx, random) };
}

function shuttle({ from, to, speed, pause, offset }, time) {
  const run = (to - from) / speed;
  let t = (time + offset) % (2 * (run + pause));
  if (t < run) return [from + t * speed, 1, true];
  t -= run;
  if (t < pause) return [to, 1, false];
  t -= pause;
  if (t < run) return [to - t * speed, -1, true];
  return [from, -1, false];
}

function dot(ctx, x, y, colour, w = 1, h = 1) {
  ctx.fillStyle = colour;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function line(ctx, [ax, ay], [bx, by], colour, width) {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
}

function wake(ctx, x, y, tx, ty, nx, ny, length, spread) {
  for (let k = 1; k <= length; k++) {
    ctx.globalAlpha = (1 - k / (length + 1)) * 0.6;
    for (const side of [-1, 1]) {
      dot(ctx, x - tx * k * 1.3 + nx * side * k * spread, y - ty * k * 1.3 + ny * side * k * spread, '#c4e0d3');
    }
  }
  ctx.globalAlpha = 1;
}

function paintBoat(ctx, river, boat, time, bounds) {
  const [s, direction, moving] = shuttle(boat, time);
  const centre = river.samples[Math.round(s)];
  if (!centre || centre.sx < bounds.left - 20 || centre.sx > bounds.right + 20
    || centre.sy < bounds.top - 20 || centre.sy > bounds.bottom + 20) return;
  for (let i = Math.round(s) - 2; i <= Math.round(s) + 2; i++) if (river.samples[i]?.covered) return;
  const f = boat.lateral + (boat.type === 'kayak' ? Math.sin(time * 0.3 + boat.seed * 9) * 0.08 : 0);
  const [x, y] = place(river, s, f);
  const ahead = place(river, s + 0.5, f), behind = place(river, s - 0.5, f);
  const length = Math.hypot(ahead[0] - behind[0], ahead[1] - behind[1]) || 1;
  const tx = (ahead[0] - behind[0]) / length * direction, ty = (ahead[1] - behind[1]) / length * direction;
  const nx = -ty, ny = tx;
  const along = k => [x + tx * k, y + ty * k];
  if (boat.type === 'eight') {
    if (moving) wake(ctx, ...along(-5.2), tx, ty, nx, ny, 5, 0.45);
    line(ctx, along(-5.2), along(5.2), '#ece6d3', 0.9);
    const sweep = moving ? Math.sin(((time * 0.55 + boat.seed) % 1) * Math.PI * 2) : 0;
    for (let i = 0; i < 8; i++) {
      const [rx, ry] = along(-3.6 + i * 0.95);
      const side = i % 2 ? 1 : -1;
      const tip = [rx + nx * side * 3 - tx * sweep * 1.3, ry + ny * side * 3 - ty * sweep * 1.3];
      line(ctx, [rx, ry], tip, '#d8c79b', 0.45);
      if (moving && sweep < -0.8) dot(ctx, tip[0], tip[1], '#eef6ee');
      dot(ctx, rx - 0.5, ry - 1, boat.colour);
    }
    dot(ctx, ...along(-4.6).map((value, k) => value - [0.5, 1][k]), '#2d3f48');
  } else if (boat.type === 'kayak') {
    if (moving) wake(ctx, ...along(-1.5), tx, ty, nx, ny, 3, 0.35);
    line(ctx, along(-1.5), along(1.5), boat.colour, 1.1);
    const side = Math.floor(time * 1.6 + boat.seed * 4) % 2 ? 1 : -1;
    line(ctx, [x - nx * side * 1.2, y - ny * side * 1.2 - 1], [x + nx * side * 1.7, y + ny * side * 1.7 - 0.4], '#e9dcb4', 0.45);
    dot(ctx, x - 0.5, y - 1.3, '#2d4048');
  } else {
    if (moving) wake(ctx, ...along(-2), tx, ty, nx, ny, 9, 0.6);
    line(ctx, along(-2), along(2), boat.colour, 1.8);
    dot(ctx, x - tx * 0.5 - 0.6, y - ty * 0.5 - 1.2, '#5b7c88', 1.3, 0.9);
  }
}

function paintFlock(ctx, flock, time, bounds) {
  const { x, y, lift, radius, speed, swans, brood, members, seed } = flock;
  if (x < bounds.left - 20 || x > bounds.right + 20 || y < bounds.top - 20 || y > bounds.bottom + 20) return;
  const angle = flock.angle + time * speed;
  for (let k = 0; k < members; k++) {
    const lag = k * (brood && k ? 1.8 : swans ? 4.5 : 3.2) / radius * Math.sign(speed);
    const a = angle - lag;
    const px = Math.round(x + Math.cos(a) * radius + (brood ? 0 : hash(seed * 1e6, k) * 2 - 1));
    const py = Math.round(y + Math.sin(a) * radius * 0.7 - lift);
    const facing = -Math.sin(a) * speed >= 0 ? 1 : -1;
    ctx.globalAlpha = 0.45;
    dot(ctx, px - facing * (swans ? 3 : 2), py + 1, '#b4d4c8');
    ctx.globalAlpha = 1;
    if (swans) {
      dot(ctx, px - 2, py, '#1e2523', 4, 1.4);
      dot(ctx, facing > 0 ? px + 1 : px - 2, py - 2, '#1e2523', 1, 2);
      dot(ctx, facing > 0 ? px + 2 : px - 3, py - 2, '#c9553a');
    } else if (brood && k) {
      dot(ctx, px, py, '#c8ad68');
    } else {
      dot(ctx, px - 1, py, '#6f5c45', 3, 1);
      dot(ctx, facing > 0 ? px + 1 : px - 1, py - 1, hash(seed * 1e6, k + 50) < 0.5 ? '#2f6650' : '#7d6a4f');
    }
  }
}

export function paintWater(ctx, water, time, bounds) {
  for (const river of water.channels) {
    const { samples, flecks } = river;
    for (let id = 0; id < flecks; id++) {
      const life = 6;
      const t = time + hash(id, 91) * life;
      const round = Math.floor(t / life);
      const local = t - round * life;
      const s = hash(id, round) * (samples.length - 1) + local * currentSpeed / sampleSpacing;
      const sample = samples[Math.floor(s)];
      if (!sample || sample.covered || sample.sx < bounds.left - 70 || sample.sx > bounds.right + 70
        || sample.sy < bounds.top - 70 || sample.sy > bounds.bottom + 70) continue;
      const [x, y] = place(river, s, hash(id + 7919, round) * 1.6 - 0.8);
      ctx.globalAlpha = Math.sin(Math.PI * local / life) * 0.7;
      dot(ctx, x, y, '#a9cfc0', 2 + id % 2, 1);
    }
    ctx.globalAlpha = 1;
    for (const boat of river.boats) paintBoat(ctx, river, boat, time, bounds);
  }
  for (const flock of water.flocks) paintFlock(ctx, flock, time, bounds);
  ctx.globalAlpha = 1;
}
