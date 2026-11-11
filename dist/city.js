// East/south metres are rotated onto an orthographic camera tilted 43° down.
export const width = 3660;
export const height = 2360;
const angle = Math.PI / 9;
const cos = Math.cos(angle);
const sin = Math.sin(angle);
const pitch = 0.68;
export const project = (x, y, z = 0) => [
  width / 2 - 540 + cos * x + sin * y,
  height / 2 - 75 + pitch * (cos * y - sin * x) - z * 0.73,
];

export const places = [
  { name: 'Lake Rotoroa', lat: -37.798467, lon: 175.274928, text: 'The Lake Domain curves around the shores of Hamilton Lake.' },
  { name: 'Seddon Park', lat: -37.786877, lon: 175.274529, text: 'Hamilton’s cricket oval sits between Frankton and the central city.' },
  { name: 'Garden Place', lat: -37.787605, lon: 175.282219, text: 'A pedestrian square linking the city centre to Victoria Street and the river.' },
  { name: 'Claudelands', lat: -37.77951, lon: 175.289567, text: 'The events centre sits next to the old kahikatea stand at Jubilee Bush.' },
  { name: 'Hamilton Gardens', lat: -37.805214, lon: 175.302265, text: 'Enclosed gardens and open parkland beside a bend in the Waikato River.' },
].map(place => ({
  ...place,
  x: (place.lon - 175.286) * 87900,
  y: (-37.792 - place.lat) * 111000,
}));

function randomSource(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const palettes = [
  ['#b66c53', '#d08d68', '#8f5147', '#e2ad88'],
  ['#627880', '#83979c', '#4b606c', '#aec1bb'],
  ['#818b79', '#a4ad91', '#687668', '#c4c9a8'],
  ['#af9b79', '#c8b797', '#8f806b', '#e1d3b6'],
  ['#776b66', '#93817b', '#5d5355', '#b5a099'],
  ['#b2b5ae', '#ccd0c6', '#8d9b99', '#e1e1cd'],
];

const roads = {
  motorway: 15, trunk: 13, primary: 11, secondary: 9, tertiary: 8,
  residential: 6, unclassified: 6, living_street: 5, service: 3.5,
  track: 2.5, cycleway: 2.4, footway: 1.7, path: 1.5, steps: 1.6, pedestrian: 4, rail: 3.5,
};

function path(points, close = false, path = new Path2D()) {
  path.moveTo(...points[0]);
  for (const point of points.slice(1)) path.lineTo(...point);
  if (close) path.closePath();
  return path;
}

function fill(ctx, points, colour) {
  ctx.fillStyle = colour;
  ctx.fill(path(points, true));
}

function stroke(ctx, route, colour, size) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = size;
  ctx.stroke(route);
}

function midpoint(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function area(points) {
  let result = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    result += a[0] * b[1] - a[1] * b[0];
  }
  return result / 2;
}

function centre(points) {
  return points.reduce(([x, y], p) => [x + p[0] / points.length, y + p[1] / points.length], [0, 0]);
}

function groundRect(ctx, x, y, w, d, colour) {
  fill(ctx, [[x, y], [x + w, y], [x + w, y + d], [x, y + d]]
    .map(point => project(...point)), colour);
}

function longestEdge(points) {
  return points.reduce(([a, b], point, i) => {
    const next = points[(i + 1) % points.length];
    return Math.hypot(point[0] - next[0], point[1] - next[1]) > Math.hypot(a[0] - b[0], a[1] - b[1])
      ? [point, next] : [a, b];
  }, [points[0], points[1]]);
}

function paintParking(ctx, shape, ring) {
  const points = ring.slice(0, -1).map(point => project(...point));
  const size = Math.abs(area(points));
  if (size < 240 || size > 18000) return;
  const [cx, cy] = centre(points);
  const [[ax, ay], [bx, by]] = longestEdge(points);
  const heading = Math.atan2(by - ay, bx - ax);
  const span = Math.min(160, Math.sqrt(size) * 2);
  const random = randomSource(Math.round(cx * 17 + cy * 137));
  ctx.save();
  ctx.clip(shape, 'evenodd');
  ctx.translate(cx, cy);
  ctx.rotate(heading);
  for (let row = -Math.ceil(span / 14) * 14; row < span; row += 14) {
    for (let col = -span; col < span; col += 3.8) {
      ctx.fillStyle = '#ece2cc9c';
      ctx.fillRect(col, row, 0.55, 4.7);
      if (random() > 0.21) continue;
      ctx.fillStyle = '#4e5c6165';
      ctx.fillRect(col + 1.1, row + 0.8, 2.2, 4.1);
      ctx.fillStyle = ['#e6ddd0', '#667d8d', '#b86b58', '#495e63'][Math.floor(random() * 4)];
      ctx.fillRect(col + 0.8, row + 0.3, 2.1, 3.8);
      ctx.fillStyle = '#b1c3c5';
      ctx.fillRect(col + 1, row + 1, 1.6, 0.65);
    }
  }
  ctx.restore();
}

function paintLandmarks(ctx, layers) {
  const [lake, seddon, square, , gardens] = places;
  // Find the inner oval from the mapped playing surface.
  const cricket = layers.get('pitch').find(({ rings }) => {
    const [x, y] = centre(rings[0]);
    const size = Math.abs(area(rings[0]));
    return Math.hypot(x - seddon.x, y - seddon.y) < 58 && size > 8500 && size < 18000;
  });
  if (cricket) {
    const ring = cricket.rings[0];
    const [x, y] = centre(ring);
    const boundary = ring.map(([px, py]) => project(x + (px - x) * 0.96, y + (py - y) * 0.96));
    stroke(ctx, path(boundary, true), '#e8e4b6', 1.2);
    groundRect(ctx, x - 4, y - 12, 8, 24, '#9b9b5c');
    groundRect(ctx, x - 2, y - 10, 4, 20, '#d3b580');
    for (const line of [y - 8, y + 7]) groundRect(ctx, x - 2, line, 4, 1, '#fcf0cc');
  }

  for (const { shape, rings } of layers.get('plaza') || []) {
    const [x, y] = centre(rings[0]);
    if (Math.min(Math.hypot(x - square.x, y - square.y),
      Math.hypot(x - gardens.x, y - gardens.y)) > 95) continue;
    const [px, py] = project(x, y);
    ctx.save();
    ctx.clip(shape, 'evenodd');
    ctx.translate(px, py);
    ctx.rotate(-0.24);
    ctx.fillStyle = '#8f806d43';
    for (let offset = -90; offset <= 90; offset += 4) {
      ctx.fillRect(offset, -90, 0.65, 180);
      ctx.fillRect(-90, offset, 180, 0.65);
    }
    ctx.restore();
  }

  // These flower patterns are ornamental details inside mapped planting areas.
  for (const { shape, rings } of layers.get('grass') || []) {
    const [x, y] = centre(rings[0]);
    const size = Math.abs(area(rings[0]));
    if (Math.hypot(x - gardens.x, y - gardens.y) > 95 || size < 80 || size > 1500) continue;
    const colour = ['#e39c72', '#d88791', '#f1c37b'];
    ctx.save();
    ctx.clip(shape, 'evenodd');
    for (let row = -18; row <= 18; row += 5) {
      for (let col = -20; col <= 20; col += 4) {
        groundRect(ctx, x + col, y + row, 2.5, 2.6, '#587648');
        groundRect(ctx, x + col, y + row, 1.3, 1.3, colour[(row + col + 42) % colour.length]);
      }
    }
    ctx.restore();
  }

  // A few birds on the open lake give a sense of scale at close zoom.
  for (const [dx, dy] of [[17, 5], [21, 8], [24, 6], [-41, 29], [-45, 34]]) {
    const [x, y] = project(lake.x + dx, lake.y + dy);
    ctx.fillStyle = '#285f66';
    ctx.fillRect(Math.round(x), Math.round(y + 1), 5, 1);
    ctx.fillStyle = '#fff2d5';
    ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
  }
}

function paintBuilding(ctx, ground, metres, type, taggedHeight, levels, random) {
  const footprint = path(ground, true);
  const size = Math.abs(area(metres));
  const house = size < 430 && !['industrial', 'commercial', 'retail', 'apartments'].includes(type);
  const tall = Math.max(2.4, Math.min(85, parseFloat(taggedHeight)
    || parseFloat(levels) * 3.3 || (house ? 3.5 + random() * 2.5 : 5 + random() * 7))) * 0.73;
  const [roof, light, dark, trim] = palettes[Math.floor(random() * palettes.length)];
  const detailRandom = randomSource(Math.round(ground[0][0] * 433 + ground[0][1] * 313));
  const shopfront = !house && size < 2400 && tall < 19;
  const top = ground.map(([x, y]) => [x, y - tall]);
  const front = area(ground) > 0 ? 1 : -1;

  ctx.fillStyle = '#4e574b35';
  ctx.fill(footprint);
  fill(ctx, ground.map(([x, y]) => [x + tall * 0.85, y + tall * 0.39]), '#45574647');

  for (let i = 0; i < ground.length; i++) {
    const j = (i + 1) % ground.length;
    const a = ground[i], b = ground[j];
    if ((b[0] - a[0]) * front >= 0) continue;
    const sunny = (b[1] - a[1]) * front > 0;
    const walls = type === 'industrial' ? ['#c5c9b4', '#899b92']
      : house ? ['#e6d3af', '#aa9d8b'] : ['#c8ba9b', '#9f9988'];
    fill(ctx, [top[i], top[j], b, a], walls[sunny ? 0 : 1]);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const windows = Math.floor(length / (house ? 5 : 4));
    for (let level = 2; level < tall - 1; level += 2.8) {
      for (let k = 1; k <= windows; k++) {
        const [x, y] = midpoint(a, b, k / (windows + 1));
        ctx.fillStyle = detailRandom() > 0.89 ? '#d8bb7c' : sunny ? '#526a68' : '#415c61';
        ctx.fillRect(Math.round(x), Math.round(y - level), house ? 1.7 : 1.9, 1.35);
        ctx.fillStyle = '#f7dfb771';
        ctx.fillRect(Math.round(x), Math.round(y - level) + 1, 2, 0.65);
      }
    }
    if (shopfront && length > 11) {
      const from = midpoint(a, b, 0.12), to = midpoint(a, b, 0.86);
      const fascia = [from, to].map(([x, y]) => [x, y - 2.6]);
      stroke(ctx, path(fascia), '#4c6563', 1.7);
      stroke(ctx, path(fascia.map(([x, y]) => [x - 1, y - 1.3])), light, 1.5);
    }
  }

  fill(ctx, top, roof);
  if (ground.length === 4 && house && size > 48) {
    const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const [a, b, c, d] = distance(metres[0], metres[1]) < distance(metres[1], metres[2])
      ? top : [top[1], top[2], top[3], top[0]];
    const r1 = midpoint(a, b, 0.5), r2 = midpoint(d, c, 0.5);
    const ridge = Math.min(4.5, Math.max(1.6, Math.sqrt(size) * 0.16));
    r1[1] -= ridge;
    r2[1] -= ridge;
    fill(ctx, [a, r1, r2, d], light);
    fill(ctx, [b, c, r2, r1], dark);
    fill(ctx, [a, b, r1], roof);
    fill(ctx, [c, d, r2], roof);
    for (const t of [0.28, 0.54, 0.79]) {
      stroke(ctx, path([midpoint(a, r1, t), midpoint(d, r2, t)]), '#f7e6bd45', 0.6);
      stroke(ctx, path([midpoint(b, r1, t), midpoint(c, r2, t)]), '#393b3840', 0.65);
    }
    stroke(ctx, path([r1, r2]), trim, 0.8);
  } else {
    ctx.save();
    ctx.clip(path(top, true));
    stroke(ctx, path(top, true), light, 2.1);
    const [cx, cy] = centre(top);
    if (size > 250) {
      const span = Math.min(180, Math.sqrt(size) * 1.8);
      const edge = longestEdge(top);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(edge[1][1] - edge[0][1], edge[1][0] - edge[0][0]));
      ctx.fillStyle = type === 'industrial' ? '#f6f1ce32' : '#f6f1ce18';
      for (let offset = -span; offset < span; offset += size > 2000 ? 5 : 3.5) {
        ctx.fillRect(-span, offset, span * 2, 0.85);
      }
      ctx.restore();
    }
    if (size > 170) {
      for (let i = 0; i < Math.min(95, size / 16); i++) {
        const x = Math.round(cx + (detailRandom() - 0.5) * Math.sqrt(size) * 1.6);
        const y = Math.round(cy + (detailRandom() - 0.5) * Math.sqrt(size));
        ctx.fillStyle = i % 2 ? '#fff4cd26' : '#34443c2b';
        ctx.fillRect(x, y, 1 + i % 3, 1);
      }
      ctx.fillStyle = dark;
      ctx.fillRect(Math.round(cx - 3), Math.round(cy - 1), 8, 4);
      ctx.fillStyle = trim;
      ctx.fillRect(Math.round(cx - 4), Math.round(cy - 2), 6, 3);
      if (size > 700) {
        ctx.fillStyle = light;
        ctx.fillRect(Math.round(cx + 11), Math.round(cy + 4), 9, 4);
        ctx.fillStyle = dark;
        ctx.fillRect(Math.round(cx + 11), Math.round(cy + 7), 9, 1);
      }
    }
    ctx.restore();
  }
}

function paintTree(ctx, x, y, radius, variant) {
  const greens = [
    ['#365949', '#537b52', '#73965a', '#91a964'],
    ['#3e6249', '#5f8354', '#83a363', '#a8b973'],
    ['#315c50', '#447864', '#629270', '#85ae79'],
  ][variant];
  const r = radius;
  ctx.fillStyle = '#354d4038';
  ctx.fillRect(x, y, r * 1.6, r * 0.6);
  ctx.fillStyle = '#6e6045';
  ctx.fillRect(x, y - r, 1.4, r);
  y -= r * 1.3;
  fill(ctx, [[x-r,y], [x-r,y-r*.55], [x-r*.53,y-r], [x+r*.35,y-r], [x+r,y-r*.38],
    [x+r,y+r*.36], [x+r*.5,y+r*.7], [x-r*.55,y+r*.65]], greens[0]);
  ctx.fillStyle = greens[1];
  ctx.fillRect(x-r*.78, y-r*.56, r*1.52, r*.86);
  ctx.fillStyle = greens[2];
  ctx.fillRect(x-r*.71, y-r*.72, r*1.07, r*.65);
  ctx.fillRect(x-r*.85, y-r*.25, r*.82, r*.43);
  ctx.fillStyle = greens[3];
  ctx.fillRect(x-r*.57, y-r*.77, r*.55, r*.25);
  ctx.fillRect(x-r*.7, y-r*.34, r*.34, r*.22);
  for (const [dx, dy] of [[-0.48, -0.56], [-0.1, -0.68], [0.28, -0.34], [-0.58, 0.1]]) {
    ctx.fillStyle = greens[2 + (Math.round(x + y + dx * 10) & 1)];
    ctx.fillRect(Math.round(x + r * dx), Math.round(y + r * dy), Math.max(1, Math.round(r * 0.28)), 1);
  }
}

function makeLayer() {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  return layer;
}

export function paintCity(ctx, data) {
  const random = randomSource(76291);
  const areaLayers = new Map();
  for (const [kind, rings] of data.areas) {
    const shape = new Path2D();
    for (const ring of rings) path(ring.map(p => project(...p)), true, shape);
    if (!areaLayers.has(kind)) areaLayers.set(kind, []);
    areaLayers.get(kind).push({ shape, rings });
  }

  ctx.fillStyle = '#a8b37b';
  ctx.fillRect(0, 0, width, height);
  for (const [kind, colour] of [['grass','#a3b97b'], ['wood','#789460'], ['pitch','#8cb26f'], ['parking','#b0aaa0'], ['plaza','#cfc2aa']]) {
    for (const { shape, rings } of areaLayers.get(kind) || []) {
      ctx.fillStyle = colour;
      ctx.fill(shape, 'evenodd');
      stroke(ctx, shape, '#dddcaa72', 1.3);
      if (kind === 'parking') paintParking(ctx, shape, rings[0]);
      if (kind === 'pitch') {
        const points = rings[0].map(p => project(...p));
        const [cx, cy] = centre(points);
        const size = Math.abs(area(points));
        if (size < 750) continue;
        const span = Math.sqrt(size) * 2;
        ctx.save();
        ctx.clip(shape, 'evenodd');
        ctx.translate(cx, cy);
        ctx.rotate(-0.24);
        ctx.fillStyle = '#e2dba62b';
        for (let stripe = -span; stripe < span; stripe += 14) {
          ctx.fillRect(-span, stripe, span * 2, 7);
        }
        ctx.restore();
      }
    }
  }
  for (let i = 0; i < 190000; i++) {
    ctx.fillStyle = i % 2 ? '#e3d9ad30' : '#536c4e23';
    ctx.fillRect(Math.floor(random() * width), Math.floor(random() * height), 1 + i % 4, 1);
  }

  // Houses sit on a mix of pale garden plots and darker yards.
  const buildings = data.buildings.map(([type, taggedHeight, levels, ring]) => {
    const metres = ring.slice(0, -1);
    const ground = metres.map(p => project(...p));
    const [cx, cy] = centre(ground);
    const yard = ground.map(([x, y]) => [x + (x - cx) * 0.4 + 1, y + (y - cy) * 0.55]);
    fill(ctx, yard, type === 'commercial' || type === 'industrial' ? '#bcb4a1'
      : ['#b6ba8e','#a2aa77','#b2b17e','#bec097'][Math.floor(random() * 4)]);
    return { ground, metres, type, taggedHeight, levels, cx, cy };
  });

  const waterPaths = areaLayers.get('water') || [];
  for (const { shape } of waterPaths) {
    stroke(ctx, shape, '#78956c', 6);
    const colour = ctx.createLinearGradient(0, 0, width, height);
    colour.addColorStop(0, '#407f85');
    colour.addColorStop(0.48, '#327780');
    colour.addColorStop(1, '#4c9394');
    ctx.fillStyle = colour;
    ctx.fill(shape, 'evenodd');
    ctx.save();
    ctx.clip(shape, 'evenodd');
    stroke(ctx, shape, '#568c87', 10);
    stroke(ctx, shape, '#71a092', 3);
    ctx.restore();
  }
  const ripples = [];
  for (const { shape, rings } of waterPaths) {
    const points = rings.flat().map(p => project(...p));
    const x0 = Math.max(0, Math.min(...points.map(p => p[0])));
    const x1 = Math.min(width, Math.max(...points.map(p => p[0])));
    const y0 = Math.max(0, Math.min(...points.map(p => p[1])));
    const y1 = Math.min(height, Math.max(...points.map(p => p[1])));
    const count = Math.min(23000, Math.ceil((x1 - x0) * (y1 - y0) / 24));
    for (let i = 0; i < count; i++) {
      const x = Math.floor(x0 + random() * (x1 - x0));
      const y = Math.floor(y0 + random() * (y1 - y0));
      const length = 2 + Math.floor(random() * 9);
      if (!ctx.isPointInPath(shape, x, y, 'evenodd') || !ctx.isPointInPath(shape, x + length, y, 'evenodd')) continue;
      ctx.fillStyle = i % 3 ? '#6ba6a155' : '#225f7155';
      ctx.fillRect(x, y, length, 1);
      if (i % 19 === 0) ripples.push([x, y, length, random() * 8]);
    }
  }

  paintLandmarks(ctx, areaLayers);

  const routes = data.roads.flatMap(([kind, bridge, tunnel, line]) => {
    const size = roads[kind] || roads[kind.replace(/_link$/, '')];
    if (!size || tunnel) return [];
    const points = line.map(p => project(...p));
    return [{ kind, bridge, size, points, shape: path(points) }];
  }).sort((a, b) => Number(a.bridge) - Number(b.bridge) || a.size - b.size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const bridge of [false, true]) {
    const pass = routes.filter(route => route.bridge === bridge);
    for (const route of pass) {
      if (bridge) stroke(ctx, route.shape, '#33565775', route.size + 7);
      stroke(ctx, route.shape, bridge ? '#d7caba' : '#ded3b5', route.size + 2.5);
    }
    for (const { kind, shape, size } of pass) {
      const surface = kind === 'rail' ? '#6d625c' : size < 3 ? '#cfbd92' : '#727e80';
      stroke(ctx, shape, surface, size);
      if (size >= 8 || kind === 'rail') {
        ctx.setLineDash(kind === 'rail' ? [1, 3] : [5, 6]);
        stroke(ctx, shape, kind === 'rail' ? '#b7a892' : '#e1d5a7', kind === 'rail' ? 4.8 : 0.85);
        ctx.setLineDash([]);
      }
    }
  }

  // The bridge deck edges catch the light and posts give the spans a readable rhythm.
  for (const { bridge, size, points } of routes) {
    if (!bridge || size < 6) continue;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const length = Math.hypot(dx, dy);
      if (length < 2) continue;
      for (const side of [-1, 1]) {
        const offset = side * (size / 2 + 0.4) / length;
        const rail = [[a[0] - dy * offset, a[1] + dx * offset], [b[0] - dy * offset, b[1] + dx * offset]];
        stroke(ctx, path(rail), side === 1 ? '#4c6364' : '#e0ceb0', 1);
        for (let d = 3; d < length; d += 5) {
          const [x, y] = midpoint(...rail, d / length);
          ctx.fillStyle = '#efddbd';
          ctx.fillRect(Math.round(x), Math.round(y - 1), 1, 2);
        }
      }
    }
  }

  const foreground = makeLayer();
  const front = foreground.getContext('2d');
  const objects = [];
  for (const building of buildings) {
    const { ground, metres, type, taggedHeight, levels, cx, cy } = building;
    if (cx < -120 || cx > width + 120 || cy < -120 || cy > height + 120) continue;
    objects.push({ y: Math.max(...ground.map(p => p[1])), draw: () =>
      paintBuilding(front, ground, metres, type, taggedHeight, levels, random) });
  }

  const addTree = (x, y, radius) => {
    if (x < -10 || x > width + 10 || y < -10 || y > height + 15) return;
    const variant = Math.floor(random() * 3);
    objects.push({ y, draw: () => paintTree(front, Math.round(x), Math.round(y), radius, variant) });
  };
  for (const point of data.trees) addTree(...project(...point), 3 + random() * 4);
  for (const { shape, rings } of areaLayers.get('wood') || []) {
    const ring = rings[0].map(p => project(...p));
    const minX = Math.max(0, Math.min(...ring.map(p => p[0])));
    const maxX = Math.min(width, Math.max(...ring.map(p => p[0])));
    const minY = Math.max(0, Math.min(...ring.map(p => p[1])));
    const maxY = Math.min(height, Math.max(...ring.map(p => p[1])));
    for (let y = minY; y < maxY; y += 8) {
      for (let x = minX; x < maxX; x += 9) {
        const px = x + random() * 9, py = y + random() * 8;
        if (ctx.isPointInPath(shape, px, py, 'evenodd')) addTree(px, py, 3 + random() * 4.5);
      }
    }
  }
  for (const { ground, cx, cy, type } of buildings) {
    if (type === 'industrial' || random() > 0.53) continue;
    const [gx, gy] = ground[Math.floor(random() * ground.length)];
    const x = gx + (gx - cx) * 0.45, y = gy + (gy - cy) * 0.5;
    if (!waterPaths.some(({shape}) => ctx.isPointInPath(shape, x, y, 'evenodd'))) addTree(x, y, 2.2 + random() * 3.7);
  }
  objects.sort((a, b) => a.y - b.y).forEach(object => object.draw());

  const crossings = routes.filter(route => route.bridge);
  const visibleRipples = ripples.filter(([x, y]) => !crossings.some(({ shape, size }) => {
    ctx.lineWidth = size + 3;
    return ctx.isPointInStroke(shape, x, y);
  }));

  const cars = [];
  for (const { kind, size, points } of routes) {
    if (size < 8 || kind === 'rail' || random() > 0.58) continue;
    const segments = [];
    let distance = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 0.01) continue;
      segments.push({ a, b, start: distance, end: distance + length, length });
      distance += length;
    }
    if (distance < 45) continue;
    for (let d = 0; d < distance; d += 108) {
      cars.push({ segments, distance, phase: random() * distance, speed: 9 + random() * 5,
        direction: random() > 0.5 ? 1 : -1, lane: size * 0.21,
        colour: ['#f4dfb9', '#b8594a', '#354f62', '#d9a650', '#ebdfce'][Math.floor(random() * 5)] });
    }
  }

  return { foreground, ripples: visibleRipples, cars };
}

export function paintMovement(ctx, layers, time, bounds) {
  for (const [x, y, length, phase] of layers.ripples) {
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) continue;
    const crest = Math.sin(time * 1.8 + phase);
    if (crest < 0.45) continue;
    ctx.fillStyle = crest > 0.85 ? '#a0c4aa9a' : '#82b5aa72';
    ctx.fillRect(x, y, Math.ceil(length * crest), 1);
  }
  for (const { segments, distance, phase, speed, direction, lane, colour } of layers.cars) {
    const along = (phase + time * speed) % distance;
    const offset = direction > 0 ? along : distance - along;
    const segment = segments.find(s => offset <= s.end) || segments.at(-1);
    const { a, b, length } = segment;
    const dx = (b[0] - a[0]) / length * direction;
    const dy = (b[1] - a[1]) / length * direction;
    let [x, y] = midpoint(a, b, (offset - segment.start) / length);
    x += dy * lane;
    y -= dx * lane;
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) continue;
    const fade = Math.min(1, along / 8, (distance - along) / 8);
    ctx.globalAlpha = fade;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = '#425454';
    ctx.fillRect(-2, -0.5, 5, 2.5);
    ctx.fillStyle = colour;
    ctx.fillRect(-2, -1.5, 4.5, 2.5);
    ctx.fillStyle = '#809699';
    ctx.fillRect(0.3, -1.4, 0.9, 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
