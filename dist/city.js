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
  { name: 'Lake Rotoroa', lat: -37.798467, lon: 175.274928, viewScale: 1.02, viewOffsetX: 78, text: 'The Lake Domain curves around the shores of Hamilton Lake.' },
  { name: 'Seddon Park', lat: -37.786877, lon: 175.274529, text: 'Hamilton’s cricket oval sits between Frankton and the central city.' },
  { name: 'Garden Place', lat: -37.787605, lon: 175.282219, text: 'A pedestrian square linking the city centre to Victoria Street and the river.' },
  { name: 'Claudelands', lat: -37.77951, lon: 175.289567, text: 'The events centre sits next to the old kahikatea stand at Jubilee Bush.' },
  { name: 'Hamilton Gardens', lat: -37.805214, lon: 175.302265, text: 'Enclosed gardens and open parkland beside a bend in the Waikato River.' },
  { name: 'Victoria Bridge', lat: -37.7913018, lon: 175.2897767, bridge: 'arch', text: 'The 1910 steel deck arch links Hamilton Central and Hamilton East.' },
  { name: 'Claudelands Bridge', lat: -37.7844701, lon: 175.2830619, bridge: 'truss', text: 'The steel truss crosses the Waikato River beside the former railway bridge.' },
  { name: 'Steele Park', lat: -37.794124, lon: 175.294721, viewScale: 0.98, viewOffsetX: -204, text: 'An open sports field beside Grey Street in Hamilton East.' },
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

function paintRelief(ctx, terrain) {
  const grid = document.createElement('canvas');
  grid.width = terrain.width;
  grid.height = terrain.height;
  const pixels = grid.getContext('2d');
  const image = pixels.createImageData(grid.width, grid.height);
  const shade = atob(terrain.shade);
  for (let i = 0; i < shade.length; i++) {
    const relief = shade.charCodeAt(i) - 128;
    const offset = i * 4;
    image.data[offset] = relief > 0 ? 244 : 43;
    image.data[offset + 1] = relief > 0 ? 228 : 72;
    image.data[offset + 2] = relief > 0 ? 169 : 61;
    image.data[offset + 3] = Math.abs(relief) * 1.35;
  }
  pixels.putImageData(image, 0, 0);
  const [x, y] = project(terrain.x, terrain.y);
  ctx.save();
  ctx.transform(cos * terrain.step, -pitch * sin * terrain.step,
    sin * terrain.step, pitch * cos * terrain.step, x, y);
  ctx.drawImage(grid, -0.5, -0.5);
  ctx.restore();
}

function paintBridgeStructure(ctx, route, style) {
  const a = route.points[0], b = route.points.at(-1);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 45) return;
  const sideX = -(b[1] - a[1]) / length * route.size * 0.5;
  const sideY = (b[0] - a[0]) / length * route.size * 0.5;
  function point(t, side, raise = 0) {
    const [x, y] = midpoint(a, b, t);
    return [x + sideX * side, y + sideY * side - raise];
  }
  if (style === 'arch') {
    const nearSide = Math.sign(sideY);
    const arch = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24;
      return point(0.15 + t * 0.7, nearSide, -22 + 20 * 4 * t * (1 - t));
    });
    for (let i = 0; i < arch.length; i += 3) {
      stroke(ctx, path([arch[i], point(0.15 + i / 24 * 0.7, nearSide)]), '#526a68', 1.1);
    }
    stroke(ctx, path(arch), '#456463', 2.3);
    stroke(ctx, path(arch.map(([x, y]) => [x, y - 0.7])), '#82958a', 0.8);
  } else {
    const nearSide = Math.sign(sideY);
    for (const t of [0.27, 0.53, 0.78]) {
      stroke(ctx, path([point(t, nearSide, -1), point(t, nearSide, -15)]), '#8c9182', 3.4);
    }
    const lower = [];
    for (let i = 0; i <= 14; i++) {
      const t = 0.04 + i / 14 * 0.92;
      lower.push(point(t, nearSide, -5.2));
      if (i > 0) stroke(ctx, path([point(t, nearSide, -0.6), lower[i - 1]]), '#546a65', 1.1);
    }
    stroke(ctx, path(lower), '#485e5c', 1.35);
  }
}

function paintBuilding(ctx, ground, metres, type, taggedHeight, levels, measured, random, roofSample) {
  const footprint = path(ground, true);
  const size = Math.abs(area(metres));
  const house = size < 430 && !['industrial', 'commercial', 'retail', 'apartments'].includes(type);
  const fallback = house ? 3.5 + random() * 2.5 : 5 + random() * 7;
  const pitched = house && ground.length === 4 && size > 48 && (!measured || measured[1] >= 0.9);
  const measuredHeight = measured && (pitched ? measured[0] : measured[0] + measured[1] * 0.5);
  const tall = Math.max(1.8, Math.min(95, measuredHeight || parseFloat(taggedHeight)
    || parseFloat(levels) * 3.3 || fallback)) * 0.73;
  const palette = palettes[Math.floor(random() * palettes.length)];
  const [roof, light, dark, trim] = roofSample
    ? [0, 0.17, -0.2, 0.31].map(amount => {
      const channels = [1, 3, 5].map(offset => {
        const value = parseInt(roofSample.slice(offset, offset + 2), 16);
        return Math.round(amount > 0 ? value + (255 - value) * amount : value * (1 + amount));
      });
      return 'rgb(' + channels.join(',') + ')';
    })
    : palette;
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
  if (pitched) {
    const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const [a, b, c, d] = distance(metres[0], metres[1]) < distance(metres[1], metres[2])
      ? top : [top[1], top[2], top[3], top[0]];
    const r1 = midpoint(a, b, 0.5), r2 = midpoint(d, c, 0.5);
    const ridge = measured ? Math.min(5, measured[1] * 0.73) : Math.min(4.5, Math.max(1.6, Math.sqrt(size) * 0.16));
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

function paintTree(ctx, x, y, height, radius, seed) {
  const random = randomSource(seed);
  const palettes = [
    ['#294f3a', '#416b41', '#628749', '#91a75b'],
    ['#31533e', '#547747', '#799252', '#afae63'],
    ['#294e47', '#3a6c53', '#54896a', '#81a979'],
    ['#384c32', '#607245', '#7f8e50', '#aab773'],
  ];
  const greens = palettes[Math.floor(random() * palettes.length)];
  const r = radius;
  const rise = Math.max(r, height * 0.47);
  const shadowX = x + rise * 0.55;
  const shadowY = y + rise * 0.28;
  fill(ctx, [[x - r * 0.6, y], [shadowX - r * 0.55, shadowY - r * 0.45],
    [shadowX + r * 0.65, shadowY - r * 0.38], [shadowX + r, shadowY],
    [shadowX + r * 0.52, shadowY + r * 0.48], [shadowX - r * 0.52, shadowY + r * 0.52]],
    '#314b343e');
  ctx.fillStyle = '#635b40';
  ctx.fillRect(x, Math.round(y - rise), 1.3, Math.round(rise));
  const crownY = y - rise;
  const silhouette = path(Array.from({ length: 14 }, (_, i) => {
    const angle = i * Math.PI / 7;
    const edge = r * (0.8 + random() * 0.31);
    return [Math.round(x + Math.cos(angle) * edge), Math.round(crownY + Math.sin(angle) * edge * 0.83)];
  }), true);
  ctx.fillStyle = greens[0];
  ctx.fill(silhouette);
  ctx.save();
  ctx.clip(silhouette);
  ctx.fillStyle = greens[1];
  ctx.fillRect(Math.round(x - r), Math.round(crownY - r), r * 2, r * 1.42);
  for (let i = 0; i < 6 + r * 2; i++) {
    const dx = random() * 1.8 - 1;
    const dy = random() * 1.55 - 0.87;
    const shade = dy + dx * 0.4 < -0.25 ? 2 + Number(random() > 0.7) : 1 + Number(random() > 0.65);
    ctx.fillStyle = greens[shade];
    ctx.fillRect(Math.round(x + dx * r), Math.round(crownY + dy * r), 1 + Math.floor(random() * r * 0.5),
      1 + Math.floor(random() * r * 0.25));
  }
  ctx.restore();
}

function makeLayer() {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  return layer;
}

export function paintCity(ctx, data, lidar, aerial) {
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
    const key = [...ring[0], ...ring[1], ring.length].join(',');
    const measured = lidar.buildings[key];
    const lotRandom = randomSource(Math.round(cx * 253 + cy * 119));
    if (Math.abs(area(metres)) < 300 && lotRandom() < 0.64) {
      const [gx, gy] = ground[Math.floor(lotRandom() * ground.length)];
      const ex = gx + (gx - cx) * 0.34, ey = gy + (gy - cy) * 0.48;
      stroke(ctx, path([[ex - 3, ey + 1], [ex + 3, ey - 1]]), '#688b57', 2.2);
      ctx.fillStyle = lotRandom() < 0.5 ? '#d2a978' : '#b17d76';
      ctx.fillRect(Math.round(ex), Math.round(ey), 2, 1);
    }
    return { ground, metres, type, taggedHeight, levels, measured, cx, cy, roofSample: aerial?.roofs[key] };
  });

  paintRelief(ctx, lidar.terrain);
  if (aerial) ctx.drawImage(aerial.image, aerial.left, aerial.top);

  const waterPaths = areaLayers.get('water') || [];
  // Paint every shoreline first so adjacent water polygons cover their shared edges.
  for (const { shape } of waterPaths) stroke(ctx, shape, '#78956c', 5);
  const waterColour = ctx.createLinearGradient(0, 0, width, height);
  waterColour.addColorStop(0, '#407f85');
  waterColour.addColorStop(0.48, '#327780');
  waterColour.addColorStop(1, '#4c9394');
  ctx.fillStyle = waterColour;
  for (const { shape } of waterPaths) ctx.fill(shape, 'evenodd');
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

  const grassRandom = randomSource(42431);
  const steele = places.find(place => place.name === 'Steele Park');
  const [parkX, parkY] = project(steele.x, steele.y);
  for (const { shape, rings } of areaLayers.get('grass') || []) {
    const points = rings[0].map(point => project(...point));
    const [cx, cy] = centre(points);
    const radius = Math.min(250, Math.sqrt(Math.abs(area(points))));
    if (radius < 20) continue;
    ctx.save();
    ctx.clip(shape, 'evenodd');
    if (radius > 60 && Math.hypot(cx - parkX, cy - parkY) < 35) {
      for (let i = 0; i < 145; i++) {
        const x = cx + (grassRandom() - 0.5) * radius * 1.9;
        const y = cy + (grassRandom() - 0.5) * radius * 1.7;
        ctx.fillStyle = i % 3 ? '#c5b37318' : '#dbca8a24';
        ctx.fillRect(Math.round(x), Math.round(y), 4 + i % 22, 3 + i % 10);
      }
    }
    for (let i = 0; i < radius * 2.6; i++) {
      const x = Math.round(cx + (grassRandom() - 0.5) * radius * 2.2);
      const y = Math.round(cy + (grassRandom() - 0.5) * radius * 2.2);
      ctx.fillStyle = i % 4 ? '#668c513f' : '#e5cf876d';
      ctx.fillRect(x, y, 1 + i % 4, 1);
    }
    ctx.restore();
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
  for (const place of places.filter(place => place.bridge)) {
    const target = project(place.x, place.y);
    const crossing = routes.find(route => {
      if (!route.bridge || route.size < 6) return false;
      const mid = midpoint(route.points[0], route.points.at(-1), 0.5);
      return Math.hypot(mid[0] - target[0], mid[1] - target[1]) < 5;
    });
    if (crossing) paintBridgeStructure(ctx, crossing, place.bridge);
  }
  const objects = [];
  for (const building of buildings) {
    const { ground, metres, type, taggedHeight, levels, measured, cx, cy, roofSample } = building;
    if (cx < -120 || cx > width + 120 || cy < -120 || cy > height + 120) continue;
    objects.push({ y: Math.max(...ground.map(p => p[1])), draw: () =>
      paintBuilding(front, ground, metres, type, taggedHeight, levels, measured, random, roofSample) });
  }

  const canopy = lidar.canopy ?? data.trees.map(([x, y]) => [x, y, 8, 4]);
  for (const [east, south, treeHeight, radius] of canopy) {
    const [x, y] = project(east, south).map(Math.round);
    if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
    const seed = Math.round(east * 199 + south * 523);
    objects.push({ y, draw: () => paintTree(front, x, y, treeHeight, radius * 1.05, seed) });
  }
  objects.sort((a, b) => a.y - b.y).forEach(object => object.draw());

  const crossings = routes.filter(route => route.bridge);
  const visibleRipples = ripples.filter(([x, y]) => !crossings.some(({ shape, size }) => {
    ctx.lineWidth = size + 3;
    return ctx.isPointInStroke(shape, x, y);
  }));

  const actors = [];
  const busyPlaces = places.filter(place => !place.bridge).map(place => project(place.x, place.y));
  for (const { kind, size, points } of routes) {
    const walking = ['footway', 'path', 'pedestrian', 'cycleway'].includes(kind);
    const busy = points.some(([x, y]) => busyPlaces.some(([px, py]) =>
      Math.abs(px - x) < 160 && Math.abs(py - y) < 115));
    if (walking ? !busy && random() < 0.92 : size < 6 || kind === 'rail' || random() < 0.45) continue;
    const segments = [];
    let distance = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 0.01) continue;
      segments.push({ a, b, start: distance, end: distance + length, length });
      distance += length;
    }
    if (distance < (walking ? 17 : 34)) continue;
    const spacing = walking ? 72 : 94;
    for (let d = 0; d < distance; d += spacing) {
      const cyclist = walking && (kind === 'cycleway' || random() < 0.1);
      const vehicle = !walking && size >= 8 && random() < 0.15 ? 8 : 4.5;
      actors.push({ segments, distance, phase: (d + random() * Math.min(spacing, distance)) % distance,
        speed: cyclist ? 4 + random() * 2 : walking ? 1.1 + random() * 0.55 : 7 + random() * 5,
        direction: random() > 0.5 ? 1 : -1, lane: walking ? 0.55 : size * 0.21,
        walking, cyclist, vehicle,
        colour: ['#f6dfad', '#c85b4d', '#30566a', '#dfa648', '#e8e0c9', '#60907e'][Math.floor(random() * 6)] });
    }
  }

  const plazaVisitors = [];
  for (const { shape, rings } of areaLayers.get('plaza') || []) {
    const points = rings[0].map(point => project(...point));
    const [cx, cy] = centre(points);
    if (!busyPlaces.some(([x, y]) => Math.hypot(cx - x, cy - y) < 105)) continue;
    const spread = Math.min(70, Math.sqrt(Math.abs(area(points))) * 0.7);
    for (let group = 0; group < Math.min(6, spread / 8); group++) {
      const x = Math.round(cx + (random() - 0.5) * spread * 2);
      const y = Math.round(cy + (random() - 0.5) * spread * 2);
      if (!ctx.isPointInPath(shape, x, y, 'evenodd')) continue;
      plazaVisitors.push({ x, y, colour: '#b65345' });
      if (ctx.isPointInPath(shape, x + 4, y + 2, 'evenodd')) {
        plazaVisitors.push({ x: x + 4, y: y + 2, colour: '#3a6679' });
      }
    }
  }

  const birds = [];
  const lake = places[0];
  const centres = [project(lake.x, lake.y), ...visibleRipples.filter((_, i) => i % 160 === 30)
    .map(([x, y]) => [x, y])];
  for (const [x, y] of centres) {
    for (let i = 0; i < 5; i++) {
      birds.push({ x, y, phase: random() * 3, dx: random() * 29 - 14, dy: random() * 16 - 8 });
    }
  }

  return { foreground, ripples: visibleRipples, actors, plazaVisitors, birds };
}

function paintPerson(ctx, x, y, colour, stride = 0) {
  ctx.fillStyle = '#34494485';
  ctx.fillRect(x, y, 3, 1);
  ctx.fillStyle = '#343f4d';
  ctx.fillRect(x + stride, y - 1, 1, 2);
  ctx.fillStyle = colour;
  ctx.fillRect(x - 1, y - 3, 2, 2);
  ctx.fillStyle = '#e5b184';
  ctx.fillRect(x, y - 4, 1, 1);
}

export function paintMovement(ctx, layers, time, bounds) {
  for (const [x, y, length, phase] of layers.ripples) {
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) continue;
    const crest = Math.sin(time * 1.8 + phase);
    if (crest < 0.45) continue;
    ctx.fillStyle = crest > 0.85 ? '#a0c4aa9a' : '#82b5aa72';
    ctx.fillRect(x, y, Math.ceil(length * crest), 1);
  }
  for (const { x, y, colour } of layers.plazaVisitors) {
    if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom) {
      paintPerson(ctx, x, y, colour);
    }
  }
  for (const { segments, distance, phase, speed, direction, lane, colour, walking, cyclist, vehicle } of layers.actors) {
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
    const edge = walking ? 2 : 8;
    const fade = Math.min(1, along / edge, (distance - along) / edge);
    ctx.globalAlpha = fade;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (walking && !cyclist) {
      const stride = Math.sin(time * 11 + phase) > 0 ? -1 : 0;
      paintPerson(ctx, 0, 0, colour, stride);
    } else {
      ctx.fillStyle = '#34494485';
      ctx.fillRect(0, 0, 5, 1);
      ctx.rotate(Math.atan2(dy, dx));
      const body = cyclist ? 3.5 : vehicle;
      ctx.fillStyle = '#394951';
      ctx.fillRect(-body / 2, -0.5, body + 0.5, cyclist ? 1.5 : 2.8);
      ctx.fillStyle = colour;
      ctx.fillRect(-body / 2, -1.5, body, cyclist ? 1.5 : 2.6);
      ctx.fillStyle = '#839caa';
      ctx.fillRect(body / 2 - 1.6, -1.4, 0.9, 2);
      ctx.fillStyle = '#ffe5a9';
      ctx.fillRect(body / 2 - 0.55, -1.45, 0.55, 0.65);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// Birds fly above the foreground so their silhouettes remain visible over canopies.
export function paintBirds(ctx, birds, time, bounds) {
  for (const { x, y, dx, dy, phase } of birds) {
    if (x < bounds.left - 70 || x > bounds.right + 70 || y < bounds.top - 45 || y > bounds.bottom + 45) continue;
    const flight = time * 0.43 + phase * 0.2;
    const px = Math.round(x + Math.cos(flight) * 44 + dx);
    const py = Math.round(y + Math.sin(flight) * 23 + dy - 15);
    const wing = Math.sin(time * 15 + phase * 5) > 0 ? -1 : 1;
    ctx.fillStyle = '#f4edd6';
    ctx.fillRect(px, py, 2, 1);
    ctx.fillRect(px - 1, py + wing, 1, 1);
    ctx.fillRect(px + 2, py + wing, 1, 1);
    ctx.fillStyle = '#677f77';
    ctx.fillRect(px + 1, py + 1, 1, 1);
  }
}
