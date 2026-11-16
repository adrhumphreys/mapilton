import { landmarkBuildings, paintLandmark } from './landmarks.js?te-awa=1';
import { paintCrossings, paintSteps, streetFurniture } from './streets.js?extent=3';
import { paintTeAwaEntrance, paintTeAwaParking, paintTeAwaRoof, teAwaVisitors } from './te-awa.js?public-space=1';
import { gatheringSpots, paintPedestrianAreas } from './pedestrian-areas.js?activity=1';
import { measure, locate, hash } from './paths.js?life=3';
import { paintPerson, paintDog } from './people.js?life=3';
import { createTraffic, advanceTraffic, paintTraffic, revealSignals, paintSignals, paintVehicleLights } from './traffic.js?life=3';
import { createNight, paintNight } from './night.js?life=3';
import { createLeisure, paintLeisure } from './leisure.js?life=3';
import { createBalloons, paintBalloons } from './balloons.js?life=3';
import { createEvents, paintEvents } from './events.js?life=3';
import { createTransit, advanceTransit, paintTransit } from './transit.js?life=3';
import { paintTint } from './sky.js?life=3';
import { createWater, paintWater } from './water.js?life=3';
import { createSway, paintSway, createClouds } from './ambience.js?life=3';
export { paintClouds } from './ambience.js?life=3';

// East/south metres are rotated onto an orthographic camera tilted 43° down.
export const width = 5900;
export const height = 2800;
export const mapScale = 0.58;
const angle = Math.PI / 9;
const cos = Math.cos(angle);
const sin = Math.sin(angle);
const pitch = 0.68;
export const project = (x, y, z = 0) => [
  3880 + mapScale * (cos * x + sin * y),
  1790 + mapScale * (pitch * (cos * y - sin * x) - z * 0.73),
];

export const places = [
  { name: 'Lake Rotoroa', lat: -37.798467, lon: 175.274928, viewScale: 1.02, viewOffsetX: 78, text: 'The Lake Domain curves around the shores of Hamilton Lake.' },
  { name: 'Seddon Park', lat: -37.786877, lon: 175.274529, viewScale: 1.95, text: 'Hamilton’s cricket oval sits between Frankton and the central city.' },
  { name: 'Garden Place', lat: -37.787605, lon: 175.282219, viewScale: 2.2, hideSelectedPin: true, text: 'A pedestrian square linking the city centre to Victoria Street and the river.' },
  { name: 'Claudelands', lat: -37.77951, lon: 175.289567, viewScale: 2.35, hidePinAtCloseZoom: true, text: 'The arena and exhibition halls sit beside Jubilee Bush. The arena’s layered façade takes its cues from the forest canopy.' },
  { name: 'Hamilton Gardens', lat: -37.805214, lon: 175.302265, text: 'Enclosed gardens and open parkland beside a bend in the Waikato River.' },
  { name: 'Victoria Bridge', lat: -37.7913018, lon: 175.2897767, bridge: 'arch', text: 'The 1910 steel deck arch links Hamilton Central and Hamilton East.' },
  { name: 'Claudelands Bridge', lat: -37.7844701, lon: 175.2830619, bridge: 'truss', text: 'The steel truss crosses the Waikato River beside the former railway bridge.' },
  { name: 'Steele Park', lat: -37.794124, lon: 175.294721, viewScale: 0.98, viewOffsetX: -204, text: 'An open sports field beside Grey Street in Hamilton East.' },
  { name: 'Made Hamilton', lat: -37.792788, lon: 175.292541, viewScale: 2.55, hidePinAtCloseZoom: true, text: 'The Grey Street market occupies the former Waikato Regional Council offices.' },
  { name: 'St Mary’s Cathedral', lat: -37.790302, lon: 175.29312, viewScale: 2.55, hidePinAtCloseZoom: true, text: 'The Cathedral of the Blessed Virgin Mary rises above a broad entrance stair on Grey Street.' },
  { name: 'Waikato Museum', lat: -37.789748, lon: 175.286535, viewScale: 2.55, hidePinAtCloseZoom: true, text: 'Te Whare Taonga o Waikato Museum & Gallery sits on the riverbank off Grantham Street.' },
  { name: 'Central Library', lat: -37.788180, lon: 175.282633, viewScale: 2.55, hidePinAtCloseZoom: true, text: 'Te Koopuu Maania o Kirikiriroa faces Garden Place with a glazed façade and folded steel canopy.' },
  { name: 'St Peter’s Cathedral', lat: -37.792297, lon: 175.286398, viewScale: 2.55, hidePinAtCloseZoom: true, text: 'The Anglican cathedral and its square bell tower stand on Pukerangiora above Victoria Street.' },
  { name: 'ArtsPost', lat: -37.789742, lon: 175.285732, viewScale: 3.25, hidePinAtCloseZoom: true, text: 'The former Hamilton Post and Telegraph Office at Victoria and Hood Streets houses ArtsPost.' },
  { name: 'Gardens Pavilion', lat: -37.806105, lon: 175.302491, viewScale: 2.55, hidePinAtCloseZoom: true, text: 'The pavilion sits near Turtle Lake and the Hamilton Gardens entry precinct.' },
  { name: 'Wintec City Campus', lat: -37.788682, lon: 175.27990, viewScale: 2.35, hidePinAtCloseZoom: true, text: 'Tainui Rise reaches about 51 m above sea level near the Gallagher Hub. Nearby Anglesea Street is about 40 m, based on LiDAR samples.' },
  { name: 'FMG Stadium Waikato', lat: -37.781071, lon: 175.268416, viewScale: 1.65, text: 'The stadium sits between Mill Street and Seddon Road.' },
  { name: 'University of Waikato', lat: -37.786528, lon: 175.319365, viewScale: 1.45, viewOffsetX: -72, text: 'The Hillcrest campus extends east from Knighton Road, with The Pā and Te Manawa at its heart.' },
  { name: 'Te Rapa Racecourse', lat: -37.76634, lon: 175.24495, viewScale: 1.7, text: 'The Waikato Racing Club’s turf course runs beside the main trunk line. On the map, races run on Wednesday and Saturday afternoons, with barrier trials on other weekdays and trackwork in the early morning.' },
  { name: 'The Base · Te Rapa', lat: -37.748701, lon: 175.233218, viewScale: 2.15, hideSelectedPin: true, text: 'Te Awa’s translucent roof follows the mall’s internal street beside Maahanga Drive.' },
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

let windowSlots = [];

const vibrance = { saturation: 1.32, muted: 0.55, contrast: 1.08, lift: 3, warmth: 7 };

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

function paintLandmarks(ctx, layers) {
  const [, seddon, square, , gardens] = places;
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
    // The venue’s grass banks and pale picket fence follow the mapped oval.
    const perimeter = scale => ring.map(([px, py]) => project(x + (px - x) * scale, y + (py - y) * scale));
    for (const [scale, colour, thickness] of [[1.12, '#58784858', 6], [1.08, '#9ea76b86', 3.5],
      [1.045, '#c0be8e95', 1.8]]) {
      stroke(ctx, path(perimeter(scale), true), colour, thickness);
    }
    const fence = path(perimeter(1.025), true);
    stroke(ctx, fence, '#6f7f5f', 1.55);
    ctx.setLineDash([1, 1.15]);
    stroke(ctx, fence, '#e3debf', 1.2);
    ctx.setLineDash([]);
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
}

function paintBridgeStructure(ctx, route, style) {
  const a = route.points[0], b = route.points.at(-1);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 45) return;
  const sideX = -(b[1] - a[1]) / length * route.width * 0.5;
  const sideY = (b[0] - a[0]) / length * route.width * 0.5;
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

function paintBuilding(ctx, ground, metres, type, taggedHeight, levels, measured, random, roofSample, flatGround, lift, landmark, courtyards, elevation) {
  const footprint = path(ground, true);
  for (const hole of courtyards) path(hole.map(elevation.point), true, footprint);
  const size = Math.abs(area(metres));
  const house = size < 430 && !['industrial', 'commercial', 'retail', 'apartments'].includes(type);
  const fallback = house ? 3.5 + random() * 2.5 : 5 + random() * 7;
  const pitched = house && !courtyards.length && ground.length === 4 && size > 48 && (!measured || measured[1] >= 0.9);
  const measuredHeight = measured && (pitched ? measured[0] : measured[0] + measured[1] * 0.5);
  const tall = Math.max(1.8, Math.min(95, measuredHeight || parseFloat(taggedHeight)
    || parseFloat(levels) * 3.3 || fallback)) * 0.73 * mapScale;
  const palette = palettes[Math.floor(random() * palettes.length)];
  const [roof, light, dark, trim] = roofSample
    ? [0, 0.22, -0.3, 0.31].map(amount => {
      const channels = [1, 3, 5].map(offset => {
        const value = parseInt(roofSample.slice(offset, offset + 2), 16);
        return Math.round(amount > 0 ? value + (255 - value) * amount : value * (1 + amount));
      });
      return 'rgb(' + channels.join(',') + ')';
    })
    : palette;
  const detailRandom = randomSource(Math.round(ground[0][0] * 433 + ground[0][1] * 313));
  const shopfront = !house && size < 2400 && tall < 19;
  const top = flatGround.map(([x, y]) => [x, y - lift - tall]);
  const front = area(ground) > 0 ? 1 : -1;
  const roofShape = path(top, true);
  for (const hole of courtyards) {
    const rim = hole.map(([x, y]) => [x, y - lift - tall]);
    const floor = hole.map(elevation.point);
    const winding = area(hole) > 0 ? 1 : -1;
    for (let i = 0; i < rim.length; i++) {
      const j = (i + 1) % rim.length;
      if ((rim[j][0] - rim[i][0]) * winding > 0) {
        fill(ctx, [rim[i], rim[j], floor[j], floor[i]], '#8f8671');
      }
    }
    path(rim, true, roofShape);
  }

  ctx.fillStyle = '#4e574b35';
  ctx.fill(footprint, 'evenodd');
  ctx.fillStyle = '#35473a38';
  ctx.fill(castShadow(ground, tall * 1.5 + 1.2, (tall * 1.5 + 1.2) * 0.46));
  ctx.fillStyle = '#2e3f335c';
  ctx.fill(castShadow(ground, tall * 1.3, tall * 1.3 * 0.46));

  for (let i = 0; i < ground.length; i++) {
    const j = (i + 1) % ground.length;
    const a = ground[i], b = ground[j];
    if ((b[0] - a[0]) * front >= 0) continue;
    stroke(ctx, path([a, b]), '#26302a66', 1.4);
  }
  for (let i = 0; i < ground.length; i++) {
    const j = (i + 1) % ground.length;
    const a = ground[i], b = ground[j];
    if ((b[0] - a[0]) * front >= 0) continue;
    const sunny = (b[1] - a[1]) * front > 0;
    const walls = landmark === 'artspost' ? ['#d8a15e', '#ad7449']
      : type === 'industrial' ? ['#c5c9b4', '#899b92']
      : house ? ['#e6d3af', '#aa9d8b'] : ['#c8ba9b', '#9f9988'];
    fill(ctx, [top[i], top[j], b, a], walls[sunny ? 0 : 1]);
    if (tall > 1.4) stroke(ctx, path([[top[i][0], top[i][1] + 0.6], [top[j][0], top[j][1] + 0.6]]), '#2c332d40', 0.9);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const windows = ['cathedral', 'st-peter', 'artspost'].includes(landmark) ? 0 : Math.floor(length / (house ? 5 : 4));
    for (let level = 2; level < tall - 1; level += 2.8) {
      if (type === 'parking' && length > 5) {
        const band = [midpoint(a, b, 0.08), midpoint(a, b, 0.92)].map(([x, y]) => [x, y - level]);
        stroke(ctx, path(band), '#526160', 1);
        continue;
      }
      for (let k = 1; k <= windows; k++) {
        const [x, y] = midpoint(a, b, k / (windows + 1));
        ctx.fillStyle = detailRandom() > 0.89 ? '#d8bb7c' : sunny ? '#526a68' : '#415c61';
        ctx.fillRect(Math.round(x), Math.round(y - level), house ? 1.7 : 1.9, 1.35);
        windowSlots.push([Math.round(x), Math.round(y - level), house ? 1.7 : 1.9, house]);
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

  ctx.fillStyle = roof;
  ctx.fill(roofShape, 'evenodd');
  if (pitched) {
    const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const [a, b, c, d] = distance(metres[0], metres[1]) < distance(metres[1], metres[2])
      ? top : [top[1], top[2], top[3], top[0]];
    const r1 = midpoint(a, b, 0.5), r2 = midpoint(d, c, 0.5);
    const ridge = measured ? Math.min(5 * mapScale, measured[1] * 0.73 * mapScale)
      : Math.min(4.5 * mapScale, Math.max(1.6 * mapScale, Math.sqrt(size) * 0.16));
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
    ctx.clip(roofShape, 'evenodd');
    stroke(ctx, roofShape, light, 2.1);
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
    if (size > 170 && !landmark) {
      for (let i = 0; i < Math.min(95, size / 16); i++) {
        const x = Math.round(cx + (detailRandom() - 0.5) * Math.sqrt(size) * 1.6);
        const y = Math.round(cy + (detailRandom() - 0.5) * Math.sqrt(size));
        ctx.fillStyle = i % 2 ? '#fff4cd26' : '#34443c2b';
        ctx.fillRect(x, y, 1 + i % 3, 1);
      }
      const units = detailRandom() < 0.35 ? 0 : 1 + Math.floor(detailRandom() * Math.min(4, size / 400));
      const spread = Math.sqrt(size) * 0.5;
      for (let unit = 0; unit < units; unit++) {
        const w = 2 + Math.floor(detailRandom() * (size > 900 ? 5 : 3));
        const h = 1 + Math.floor(detailRandom() * 2);
        const x = Math.round(cx + (detailRandom() - 0.5) * spread * 2);
        const y = Math.round(cy + (detailRandom() - 0.5) * spread);
        const corners = [[x - 1, y - 1], [x + w + 2, y - 1], [x - 1, y + h + 2], [x + w + 2, y + h + 2]];
        if (!corners.every(([px, py]) => ctx.isPointInPath(roofShape, px, py, 'evenodd'))) continue;
        ctx.fillStyle = '#3b443e55';
        ctx.fillRect(x + 1, y + 1, w, h);
        ctx.fillStyle = detailRandom() < 0.5 ? '#a6aba3' : '#c3c5bb';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#7d847c';
        ctx.fillRect(x, y + h - 1, w, 1);
      }
    }
    if (landmark === 'te-awa') paintTeAwaRoof(ctx, project, lift + tall);
    ctx.restore();
  }
  if (!landmark) {
    stroke(ctx, roofShape, '#2b322c5a', 0.7);
    for (let i = 0; i < top.length; i++) {
      const a = top[i], b = top[(i + 1) % top.length];
      if ((b[0] - a[0]) * front > 0) stroke(ctx, path([[a[0], a[1] + 0.35], [b[0], b[1] + 0.35]]), '#fff6dc40', 0.6);
    }
  }
  if (landmark === 'te-awa') {
    paintTeAwaEntrance(ctx, (x, y) => elevation.point(project(x, y)));
  } else if (landmark) paintLandmark(ctx, landmark, ground, top);
}

function castShadow(ground, dx, dy) {
  const shape = new Path2D();
  const add = points => {
    const ring = area(points) < 0 ? [...points].reverse() : points;
    path(ring, true, shape);
  };
  add(ground.map(([x, y]) => [x + dx, y + dy]));
  for (let i = 0; i < ground.length; i++) {
    const a = ground[i], b = ground[(i + 1) % ground.length];
    add([a, b, [b[0] + dx, b[1] + dy], [a[0] + dx, a[1] + dy]]);
  }
  return shape;
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
    '#2b42305c');
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

function enliven(ctx) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const grey = r * 0.299 + g * 0.587 + b * 0.114;
    const base = (grey - 128) * vibrance.contrast + 128 + vibrance.lift;
    const boost = vibrance.saturation + vibrance.muted * (1 - chroma);
    const sun = vibrance.warmth * grey / 255;
    data[i] = base + (r - grey) * boost + sun;
    data[i + 1] = base + (g - grey) * boost + sun * 0.35;
    data[i + 2] = base + (b - grey) * boost - sun;
  }
  ctx.putImageData(image, 0, 0);
}

function makeLayer() {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  return layer;
}

export function paintCity(ctx, data, lidar, aerial, elevation, transitData = null) {
  const random = randomSource(76291);
  windowSlots = [];
  const areaLayers = new Map();
  for (const [kind, rings] of data.areas) {
    const shape = new Path2D();
    for (const ring of rings) path(ring.map(p => project(...p)), true, shape);
    if (!areaLayers.has(kind)) areaLayers.set(kind, []);
    areaLayers.get(kind).push({ shape, rings });
  }

  ctx.fillStyle = '#a8b37b';
  ctx.fillRect(0, 0, width, height);
  for (const [kind, colour] of [['grass','#a3b97b'], ['wood','#789460'], ['pitch','#8cb26f'], ['parking','#8b8c83'], ['plaza','#cfc2aa']]) {
    for (const { shape, rings } of areaLayers.get(kind) || []) {
      ctx.fillStyle = colour;
      ctx.fill(shape, 'evenodd');
      if (kind !== 'parking') stroke(ctx, shape, '#dddcaa72', 1.3);
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
  const buildings = data.buildings.map(([type, taggedHeight, levels, ring, holes = []]) => {
    const metres = ring.slice(0, -1);
    const ground = metres.map(p => project(...p));
    const [cx, cy] = centre(ground);
    const yard = ground.map(([x, y]) => [x + (x - cx) * 0.4 + 1, y + (y - cy) * 0.55]);
    fill(ctx, yard, type === 'commercial' || type === 'industrial' ? '#bcb4a1'
      : ['#b6ba8e','#a2aa77','#b2b17e','#bec097'][Math.floor(random() * 4)]);
    const key = [...ring[0], ...ring[1], ...ring[2], ring.length].join(',');
    const landmarkKey = [...ring[0], ...ring[1], ring.length].join(',');
    const measured = lidar.buildings[key];
    const lotRandom = randomSource(Math.round(cx * 253 + cy * 119));
    if (Math.abs(area(metres)) < 300 && lotRandom() < 0.64) {
      const [gx, gy] = ground[Math.floor(lotRandom() * ground.length)];
      const ex = gx + (gx - cx) * 0.34, ey = gy + (gy - cy) * 0.48;
      stroke(ctx, path([[ex - 3, ey + 1], [ex + 3, ey - 1]]), '#688b57', 2.2);
      ctx.fillStyle = lotRandom() < 0.5 ? '#d2a978' : '#b17d76';
      ctx.fillRect(Math.round(ex), Math.round(ey), 2, 1);
    }
    const courtyards = holes.map(hole => hole.slice(0, -1).map(point => project(...point)));
    return { ground, metres, type, taggedHeight, levels, measured, cx, cy, courtyards, roofSample: aerial?.roofs[key], landmark: landmarkBuildings[landmarkKey] };
  });

  if (aerial) {
    ctx.drawImage(aerial.ground, 0, 0);
    // Give the photographed pavement and bay markings more weight inside mapped lots.
    for (const { shape } of areaLayers.get('parking') || []) {
      ctx.save();
      ctx.clip(shape, 'evenodd');
      ctx.drawImage(aerial.ground, 0, 0);
      ctx.restore();
    }
  }

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

  const routes = data.roads.flatMap(([kind, bridge, tunnel, line, detail]) => {
    const size = roads[kind] || roads[kind.replace(/_link$/, '')];
    if (!size || tunnel) return [];
    const flat = line.map(p => project(...p));
    const points = elevation.route(flat, bridge);
    return [{ kind, bridge, size, width: size * mapScale, flat, points, steps: Array.isArray(detail) ? detail : undefined,
      parkingAisle: detail === 'parking_aisle', shape: path(bridge ? points : flat) }];
  }).sort((a, b) => Number(a.bridge) - Number(b.bridge) || a.size - b.size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const bridge of [false, true]) {
    if (bridge) {
      paintTeAwaParking(ctx, project);
      paintPedestrianAreas(ctx, project);
      paintCrossings(ctx, project, routes, data.streetDetails ?? []);
      elevation.paintShade(ctx);
      elevation.paintGround(ctx);
      paintSteps(ctx, routes, elevation);
    }
    const pass = routes.filter(route => route.bridge === bridge && !(aerial && route.parkingAisle));
    for (const route of pass) {
      if (bridge) stroke(ctx, route.shape, '#33565775', route.width + 7 * mapScale);
      if (route.kind === 'rail') stroke(ctx, route.shape, '#a99c86', route.width + 1.6 * mapScale);
      else if (route.kind !== 'service') stroke(ctx, route.shape, bridge ? '#d7caba' : '#ded3b5', route.width + 2.5 * mapScale);
    }
    for (const { kind, shape, size, width: roadWidth } of pass) {
      const surface = kind === 'rail' ? '#857867' : size < 3 ? '#cfbd92' : '#727e80';
      stroke(ctx, shape, surface, roadWidth);
      if (kind === 'rail') {
        ctx.setLineDash([1, 2]);
        stroke(ctx, shape, '#968872', roadWidth);
        ctx.setLineDash([]);
        stroke(ctx, shape, '#4d4943', 0.75);
      } else if (size >= 8) {
        ctx.setLineDash([5, 6]);
        stroke(ctx, shape, '#e1d5a7', 0.85 * mapScale);
        ctx.setLineDash([]);
      }
    }
  }

  // The bridge deck edges catch the light and posts give the spans a readable rhythm.
  for (const { bridge, size, width: roadWidth, points } of routes) {
    if (!bridge || size < 6) continue;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const length = Math.hypot(dx, dy);
      if (length < 2) continue;
      for (const side of [-1, 1]) {
        const offset = side * (roadWidth / 2 + 0.4) / length;
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
  const bridgeMarkers = new Map();
  for (const place of places.filter(place => place.bridge)) {
    const target = project(place.x, place.y);
    const crossing = routes.find(route => {
      if (!route.bridge || route.size < 6) return false;
      const mid = midpoint(route.flat[0], route.flat.at(-1), 0.5);
      return Math.hypot(mid[0] - target[0], mid[1] - target[1]) < 5;
    });
    if (crossing) {
      paintBridgeStructure(ctx, crossing, place.bridge);
      bridgeMarkers.set(place, midpoint(crossing.points[0], crossing.points.at(-1), 0.5));
    }
  }
  enliven(ctx);
  const objects = streetFurniture(project, elevation, data.streetDetails ?? []).map(({ y, draw }) => ({ y, draw: () => draw(front) }));
  for (const building of buildings) {
    const { ground, metres, type, taggedHeight, levels, measured, cx, cy, roofSample, landmark, courtyards } = building;
    if (cx < -120 || cx > width + 120 || cy < -120 || cy > height + 120) continue;
    const base = ground.map(elevation.point);
    const lift = elevation.lift(cx, cy);
    objects.push({ y: Math.max(...base.map(p => p[1])), draw: () =>
      paintBuilding(front, base, metres, type, taggedHeight, levels, measured, random, roofSample, ground, lift, landmark, courtyards, elevation) });
  }

  const canopy = lidar.canopy ?? data.trees.map(([x, y]) => [x, y, 8, 4]);
  const crowns = [];
  for (const [east, south, treeHeight, radius] of canopy) {
    const [x, y] = elevation.point(project(east, south)).map(Math.round);
    if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
    const seed = Math.round(east * 199 + south * 523);
    const r = radius * 1.05 * mapScale;
    objects.push({ y, draw: () => paintTree(front, x, y, treeHeight * mapScale, r, seed) });
    if (r < 1.6) continue;
    const crownY = y - Math.max(r, treeHeight * mapScale * 0.47);
    const half = Math.round(r * 0.8);
    crowns.push({ left: x - half, top: Math.round(crownY - r), width: half * 2 + 1,
      height: Math.max(2, Math.round(r * 0.75)), seed: hash(seed) });
  }
  objects.sort((a, b) => a.y - b.y).forEach(object => object.draw());
  const foregroundPixels = front.getImageData(0, 0, width, height).data;
  const pixel = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return [0, 0, 0, 0];
    const i = (y * width + x) * 4;
    return [foregroundPixels[i], foregroundPixels[i + 1], foregroundPixels[i + 2], foregroundPixels[i + 3]];
  };
  const sway = createSway(crowns, pixel);
  const night = createNight({ windows: windowSlots, routes, details: data.streetDetails ?? [], project, elevation, pixel,
    width, height, mapScale });
  windowSlots = [];
  enliven(front);

  const crossings = routes.filter(route => route.bridge);
  const visibleRipples = ripples.map(([x, y, length, phase]) => [
    x, elevation.point([x, y])[1], length, phase,
  ]).filter(([x, y]) => !crossings.some(({ shape, width: roadWidth }) => {
    ctx.lineWidth = roadWidth + 3 * mapScale;
    return ctx.isPointInStroke(shape, x, y);
  }));


  const actors = [];
  const activityRandom = randomSource(91487);
  const busyPlaces = places.map(place => project(place.x, place.y));
  const riverPlaces = places.filter(place => place.bridge || ['Waikato Museum', 'Made Hamilton', 'Hamilton Gardens']
    .includes(place.name)).map(place => project(place.x, place.y));
  const near = (points, centres, radius) => points.some(([x, y]) =>
    centres.some(([px, py]) => Math.hypot(px - x, py - y) < radius));
  const clothing = ['#e2bc76', '#bc5149', '#285b77', '#cf8548', '#ece1c7', '#4b816e', '#92608a'];
  const outfit = () => clothing[Math.floor(activityRandom() * clothing.length)];
  const umbrellas = ['#2c3e50', '#c0392b', '#2f6fb0', '#f2c14e', '#3f9b6a', '#2a2a2a', '#8c4fa3'];
  const dogs = ['#6b4a2f', '#e8d6b0', '#2f2a26', '#b07a43', '#f4efe4'];
  for (const { kind, points } of routes) {
    if (!['footway', 'path', 'pedestrian', 'cycleway', 'steps'].includes(kind)) continue;
    const busy = near(points, busyPlaces, 115);
    const riverside = kind !== 'steps' && near(points, riverPlaces, 85);
    if (!busy && kind !== 'cycleway' && activityRandom() < 0.72) continue;
    const route = measure(points);
    if (route.distance < (busy ? 10 : 22)) continue;
    const spacing = busy ? 32 : 58;
    for (let d = 0; d < route.distance; d += spacing) {
      const cyclist = kind === 'cycleway' || (riverside && kind === 'path' && activityRandom() < 0.26);
      const companion = !cyclist && busy && route.distance >= 20 && activityRandom() < 0.29 ? outfit() : null;
      actors.push({ route, phase: (d + activityRandom() * Math.min(spacing, route.distance)) % route.distance,
        speed: cyclist ? 3 + activityRandom() * 1.6 : 0.8 + activityRandom() * 0.55,
        direction: activityRandom() > 0.5 ? 1 : -1, cyclist, companion, colour: outfit() });
      const actor = actors.at(-1);
      actor.presence = hash(actors.length, 3301);
      actor.umbrella = umbrellas[Math.floor(hash(actors.length, 3307) * umbrellas.length)];
      if (!cyclist && !companion && !busy && hash(actors.length, 3313) < 0.28) {
        actor.dog = dogs[Math.floor(hash(actors.length, 3319) * dogs.length)];
      } else if (!cyclist && !companion && hash(actors.length, 3323) < (riverside ? 0.3 : 0.08)) {
        actor.jogger = true;
        actor.speed = 2.2 + hash(actors.length, 3329) * 0.8;
      }
    }
  }
  const traffic = createTraffic({ routes, details: data.streetDetails ?? [], project, elevation, random: activityRandom,
    clothing, busy: point => near([point], busyPlaces, 95), mapScale, buses: !transitData });
  revealSignals(traffic, pixel);
  const water = createWater({ areas: waterPaths, project, elevation, bridges: routes.filter(route => route.bridge),
    ctx, random: randomSource(5113) });

  const plazaVisitors = teAwaVisitors.map(([east, south, colour]) => {
    const [x, y] = elevation.point(project(east, south));
    return { x, y, colour };
  });
  gatheringSpots.forEach(([east, south], index) => {
    const [x, y] = project(east, south);
    const offsets = index % 3 === 0 ? [[0, 0], [2.6, 0.9], [0.9, 2.6]] : [[0, 0], [2.6, 1.5]];
    for (const [dx, dy] of offsets) {
      const [px, py] = elevation.point([x + dx, y + dy]);
      plazaVisitors.push({ x: px, y: py, colour: outfit() });
    }
  });
  for (const { shape, rings } of areaLayers.get('plaza') || []) {
    const points = rings[0].map(point => project(...point));
    const [cx, cy] = centre(points);
    if (!busyPlaces.some(([x, y]) => Math.hypot(cx - x, cy - y) < 105)) continue;
    const spread = Math.min(70, Math.sqrt(Math.abs(area(points))) * 0.7);
    for (let group = 0; group < Math.min(10, spread / 6); group++) {
      const x = Math.round(cx + (random() - 0.5) * spread * 2);
      const y = Math.round(cy + (random() - 0.5) * spread * 2);
      if (!ctx.isPointInPath(shape, x, y, 'evenodd')) continue;
      plazaVisitors.push({ x, y: elevation.point([x, y])[1], colour: '#b65345' });
      if (ctx.isPointInPath(shape, x + 4, y + 2, 'evenodd')) {
        plazaVisitors.push({ x: x + 4, y: elevation.point([x + 4, y + 2])[1], colour: '#3a6679' });
      }
    }
  }
  plazaVisitors.forEach((visitor, index) => {
    visitor.presence = hash(index, 4273);
    const partner = plazaVisitors.find(other => other !== visitor
      && Math.hypot(other.x - visitor.x, other.y - visitor.y) < 5.5);
    visitor.seed = hash(index, 4271);
    visitor.toward = partner ? Math.sign(partner.x - visitor.x) || 1 : 0;
  });

  const birds = [];
  const lake = places[0];
  const centres = [project(lake.x, lake.y), ...visibleRipples.filter((_, i) => i % 160 === 30)
    .map(([x, y]) => [x, y])];
  for (const [x, y] of centres) {
    for (let i = 0; i < 5; i++) {
      birds.push({ x, y, phase: random() * 3, dx: random() * 29 - 14, dy: random() * 16 - 8 });
    }
  }
  for (const { rings } of [...(areaLayers.get('wood') || []), ...(areaLayers.get('grass') || [])]) {
    const points = rings[0].map(point => project(...point));
    if (Math.abs(area(points)) < 20000 || random() < 0.7) continue;
    const [x, y] = centre(points);
    for (let i = 0; i < 4; i++) {
      birds.push({ x, y, phase: random() * 3, dx: random() * 18 - 9, dy: random() * 10 - 5, dark: true });
    }
  }

  return { foreground, ripples: visibleRipples, actors, plazaVisitors, birds, bridgeMarkers, traffic, water, sway, night,
    leisure: createLeisure(data.streetDetails ?? [], project, elevation, clothing),
    balloons: createBalloons(project, elevation),
    events: createEvents(data.areas, project, elevation),
    transit: transitData ? createTransit(transitData, routes, project, elevation, mapScale) : null,
    clouds: createClouds(randomSource(3307)) };
}

export function advanceTransport(layers, time, instant) {
  if (layers.transit) advanceTransit(layers.transit, layers.traffic, time, layers.clock * 1000, instant);
}

export function paintMovement(ctx, layers, time, bounds) {
  advanceTraffic(layers.traffic, time);
  for (const [x, y, length, phase] of layers.ripples) {
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) continue;
    const crest = Math.sin(time * 1.8 + phase);
    if (crest < 0.45) continue;
    ctx.fillStyle = crest > 0.85 ? '#a0c4aa9a' : '#82b5aa72';
    ctx.fillRect(x, y, Math.ceil(length * crest), 1);
  }
  paintWater(ctx, layers.water, time, bounds);
  const { sky, clock } = layers;
  paintLeisure(ctx, layers.leisure, sky, clock, bounds);
  paintEvents(ctx, layers.events, sky, clock, time, bounds);
  const wet = sky.rain > 0.15;
  for (const { x, y, colour, seed, toward, presence } of layers.plazaVisitors) {
    if (presence > sky.people * 1.15) continue;
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) continue;
    const clock = time / 3.5 + seed * 11;
    const beat = Math.floor(clock);
    const mood = hash(seed * 1e6, beat);
    const shift = mood > 0.88 ? 1 : mood < 0.08 ? -1 : 0;
    const facing = toward && mood > 0.2 ? toward : mood < 0.5 ? 1 : -1;
    const gesture = toward && hash(seed * 1e6, Math.floor(time / 0.6) + 7) < 0.22 ? toward : 0;
    paintPerson(ctx, x + shift, y, colour, shift && clock - beat < 0.12 ? -1 : 0, facing, gesture,
      wet && seed < 0.75 ? '#2c3e50' : null);
  }
  for (const { route, phase, speed, direction, colour, cyclist, companion, presence, umbrella, dog, jogger } of layers.actors) {
    if (presence > (cyclist ? sky.cyclists : sky.people)) continue;
    if (jogger && wet) continue;
    const [left, top, right, bottom] = route.bounds;
    if (right + 5 < bounds.left || left - 5 > bounds.right
      || bottom + 5 < bounds.top || top - 5 > bounds.bottom) continue;
    const along = (phase + time * speed) % route.distance;
    const [px, py, sx, sy] = locate(route, direction > 0 ? along : route.distance - along);
    const dx = sx * direction, dy = sy * direction;
    const lane = 0.55 * mapScale;
    const x = px + dy * lane, y = py - dx * lane;
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) continue;
    ctx.globalAlpha = Math.min(1, along / 2, (route.distance - along) / 2);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (!cyclist) {
      const stride = Math.sin(time * (jogger ? 17 : 11) + phase) > 0 ? -1 : 0;
      const cover = wet && presence < 0.8 ? umbrella : null;
      if (companion) paintPerson(ctx, -dx * 3 + dy, -dy * 3 - dx, companion, -stride, dx >= 0 ? 1 : -1, 0, cover);
      if (dog) paintDog(ctx, dx * 3.2 - dy * 1.2, dy * 3.2 + dx * 1.2, dog, Math.sin(time * 16 + phase) > 0, dx >= 0 ? 1 : -1);
      paintPerson(ctx, 0, jogger && stride ? -0.6 : 0, colour, stride, dx >= 0 ? 1 : -1, 0, cover);
    } else {
      ctx.save();
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillStyle = '#334448';
      ctx.fillRect(-2, 0, 1.3, 1);
      ctx.fillRect(1, 0, 1.3, 1);
      ctx.fillStyle = '#a7aaa0';
      ctx.fillRect(-1, -0.4, 2.6, 0.65);
      ctx.restore();
      ctx.fillStyle = colour;
      ctx.fillRect(-0.8, -2, 1.6, 1.5);
      ctx.fillStyle = '#f0d6aa';
      ctx.fillRect(dx * 0.7, -2.8, 0.9, 0.8);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  paintTraffic(ctx, layers.traffic, time, bounds);
  if (layers.transit) paintTransit(ctx, layers.transit, bounds, layers.clock * 1000);
}

// Birds fly above the foreground so their silhouettes remain visible over canopies.
export function paintBirds(ctx, birds, time, bounds) {
  for (const { x, y, dx, dy, phase, dark } of birds) {
    if (x < bounds.left - 70 || x > bounds.right + 70 || y < bounds.top - 45 || y > bounds.bottom + 45) continue;
    const flight = time * (dark ? 0.7 : 0.43) + phase * 0.2;
    const px = Math.round(x + Math.cos(flight) * (dark ? 26 : 44) + dx);
    const py = Math.round(y + Math.sin(flight) * (dark ? 14 : 23) + dy - (dark ? 22 : 15));
    const wing = Math.sin(time * (dark ? 19 : 15) + phase * 5) > 0 ? -1 : 1;
    ctx.fillStyle = dark ? '#2c3a34' : '#f4edd6';
    ctx.fillRect(px, py, 2, 1);
    ctx.fillRect(px - 1, py + wing, 1, 1);
    ctx.fillRect(px + 2, py + wing, 1, 1);
    ctx.fillStyle = dark ? '#e9eadb' : '#677f77';
    ctx.fillRect(px + 1, py + 1, 1, 1);
  }
}

export function paintOverlay(ctx, layers, time, bounds, scale) {
  if (scale >= 1.6) paintSway(ctx, layers.sway, layers.foreground, time, bounds);
  paintSignals(ctx, layers.traffic, time, bounds);
  if (layers.sky.darkness < 0.6) paintBirds(ctx, layers.birds, time, bounds);
}

export function paintAir(ctx, layers, bounds) {
  paintBalloons(ctx, layers.balloons, layers.sky, layers.clock, bounds);
}

export function paintSky(ctx, layers, time, bounds, scale) {
  const { sky } = layers;
  paintTint(ctx, sky, bounds);
  paintNight(ctx, layers.night, sky, bounds, scale);
  if (sky.lights > 0 && scale > 0.55) {
    paintVehicleLights(ctx, layers.traffic, bounds, sky.lights, layers.night.beam);
    if (layers.transit) paintTransit(ctx, layers.transit, bounds, layers.clock * 1000, sky.lights, layers.night.beam);
    paintSignals(ctx, layers.traffic, time, bounds);
  }
}
