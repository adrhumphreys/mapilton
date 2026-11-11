// Footprints and street furniture coordinates are from the bundled OSM extract.
export const eastBuildings = {
  '573.7,15.5,594.7,10.2,34': 'made',
  '648.1,-177.8,612.4,-167.6,13': 'cathedral',
};

const busStops = [[614.5, 61], [613.4, 2.2], [687.7, 259.3, true], [729.9, -90.4], [748.3, -82.6]];
const bikeStands = [[639.8, 79.4, 3], [618.8, 89.1, 4], [614.9, 8.5, 3]];
const benches = [[514.2, 128.7], [496.4, 179.9], [503.4, 120.9]];
const crossingPoints = [[643.9, 136.3], [783.7, -98.4]];
const greySignals = [[597.3, -32.1], [580.6, -38.6], [588.9, -52.7], [605, -45.8], [598.9, -58.5]];

function polygon(ctx, points, colour) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

function line(ctx, a, b, colour, width = 1) {
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.lineTo(...b);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function raise([x, y], height) {
  return [x, y - height];
}

// Local architectural details share the footprint's perspective and ground elevation.
export function paintEastBuilding(ctx, kind, ground, roof) {
  if (kind === 'made') {
    const a = ground[1], b = ground[2];
    const start = mix(a, b, 0.18), end = mix(a, b, 0.62);
    const edge = [start, end].map(([x, y]) => [x + 3.8, y + 1.8]);
    polygon(ctx, [raise(start, 4.9), raise(end, 4.9), raise(edge[1], 4.9), raise(edge[0], 4.9)], '#bc9562');
    line(ctx, raise(edge[0], 4.9), raise(edge[1], 4.9), '#463f35', 1.2);
    for (const t of [0.04, 0.27, 0.51, 0.75, 0.97]) {
      const post = mix(...edge, t);
      line(ctx, post, raise(post, 4.8), '#856447', 0.9);
      line(ctx, raise(mix(start, end, t), 4.9), raise(post, 4.9), '#e6ba7b', 0.75);
    }
    const sign = raise(mix(...edge, 0.5), 6.2);
    ctx.save();
    ctx.translate(...sign);
    ctx.rotate(Math.atan2(end[1] - start[1], end[0] - start[0]));
    ctx.fillStyle = '#393b35';
    ctx.fillRect(-7, -3, 14, 4);
    ctx.fillStyle = '#f4ead0';
    ctx.font = 'bold 4px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MADE', 0, 0);
    ctx.restore();

    // The riverside wing has open decks and a spiral stair.
    const deckA = mix(roof[22], roof[23], 0.2);
    const deckB = mix(roof[22], roof[23], 0.82);
    const offset = [3.5, -4.5];
    const back = [deckA, deckB].map(([x, y]) => [x + offset[0], y + offset[1]]);
    polygon(ctx, [deckA, deckB, back[1], back[0]], '#9e8263');
    line(ctx, raise(deckA, 1.3), raise(deckB, 1.3), '#4c4d42', 0.75);
    for (const t of [0.1, 0.4, 0.7, 0.95]) {
      const post = mix(deckA, deckB, t);
      line(ctx, post, raise(post, 1.3), '#4c4d42', 0.65);
    }
    const stair = mix(ground[22], ground[23], 0.42);
    for (let i = 0; i < 11; i++) {
      const theta = i * 0.85;
      const point = [stair[0] - 3.7 + Math.cos(theta) * 2.5, stair[1] - i * 0.8 + Math.sin(theta)];
      ctx.fillStyle = i % 2 ? '#ac926c' : '#6c6554';
      ctx.fillRect(point[0], point[1], 2.8, 0.9);
    }
    return;
  }

  // Brick piers, the glazed narthex, zinc roof planes and the cross above the entrance.
  const a = ground[2], b = ground[5];
  const steps = [a, b].map(([x, y]) => [x - 4.2, y + 2.6]);
  polygon(ctx, [a, b, steps[1], steps[0]], '#c7bca7');
  for (const t of [0.25, 0.52, 0.78]) {
    line(ctx, mix(a, steps[0], t), mix(b, steps[1], t), '#948b7d', 0.6);
  }
  const glassTop = [raise(a, 7), raise(b, 7)];
  polygon(ctx, [a, b, glassTop[1], glassTop[0]], '#537177');
  for (const t of [0, 0.19, 0.4, 0.6, 0.81, 1]) {
    const foot = mix(a, b, t);
    line(ctx, foot, raise(foot, 7), '#a07860', 1.15);
  }
  const ridgeA = raise(mix(roof[2], roof[6], 0.5), 3.7);
  const ridgeB = raise(mix(roof[0], roof[8], 0.5), 5);
  polygon(ctx, [roof[2], roof[1], roof[0], ridgeB, ridgeA], '#748887');
  polygon(ctx, [ridgeA, ridgeB, roof[8], roof[7], roof[6]], '#aab7ae');
  line(ctx, ridgeA, ridgeB, '#d2d7c9', 0.8);
  const tower = mix(roof[5], roof[6], 0.55);
  polygon(ctx, [[tower[0] - 2, tower[1]], [tower[0] + 2, tower[1] + 1],
    [tower[0] + 2, tower[1] - 4.8], [tower[0] - 2, tower[1] - 5.8]], '#a27c65');
  const cross = raise(tower, 5.2);
  line(ctx, cross, raise(cross, 4.4), '#f0e0a8', 1.05);
  line(ctx, [cross[0] - 1.65, cross[1] - 3], [cross[0] + 1.65, cross[1] - 3], '#f0e0a8', 0.9);
}

export function paintEastCrossings(ctx, project, routes) {
  for (const point of crossingPoints) {
    const [x, y] = project(...point);
    let nearest, distance = 7;
    for (const route of routes) {
      if (route.size < 6 || route.bridge) continue;
      for (let i = 1; i < route.flat.length; i++) {
        const a = route.flat[i - 1], b = route.flat[i];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const length = Math.hypot(dx, dy);
        if (!length) continue;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (length * length)));
        const centre = mix(a, b, t);
        const gap = Math.hypot(x - centre[0], y - centre[1]);
        if (gap >= distance) continue;
        nearest = { centre, dx: dx / length, dy: dy / length, half: route.size * 0.49 };
        distance = gap;
      }
    }
    if (!nearest) continue;
    const { centre: [cx, cy], dx, dy, half } = nearest;
    for (const offset of [-1.7, 1.7]) {
      const mx = cx + dx * offset, my = cy + dy * offset;
      line(ctx, [mx - dy * half, my + dx * half], [mx + dy * half, my - dx * half], '#e9e2c5', 0.95);
    }
    for (const side of [-1, 1]) {
      const ex = cx - dy * side * (half + 0.8), ey = cy + dx * side * (half + 0.8);
      ctx.fillStyle = '#d6ab65';
      ctx.fillRect(ex - 1, ey - 0.65, 2, 1.3);
    }
  }
}

export function eastFurniture(project, elevation) {
  const objects = [];
  const add = (points, draw) => {
    for (const [east, south, variant] of points) {
      const [x, y] = elevation.point(project(east, south));
      objects.push({ y, draw: ctx => draw(ctx, Math.round(x), Math.round(y), variant) });
    }
  };
  add(busStops, (ctx, x, y, shelter) => {
    line(ctx, [x, y], [x, y - 4], '#4d5c55');
    ctx.fillStyle = '#d2ded2';
    ctx.fillRect(x - 1, y - 5, 2.6, 1.5);
    ctx.fillStyle = '#478f65';
    ctx.fillRect(x - 1, y - 5, 2.6, 0.7);
    if (shelter) {
      polygon(ctx, [[x - 6, y - 3], [x - 1, y - 3], [x - 1, y], [x - 6, y]], '#71918b');
      line(ctx, [x - 7, y - 3.8], [x - 0.4, y - 3.8], '#3e5c57', 1.5);
    }
  });
  add(bikeStands, (ctx, x, y, count) => {
    for (let i = 0; i < count; i++) {
      line(ctx, [x + i * 1.5, y], [x + i * 1.5, y - 1.4], '#697d75', 0.75);
      ctx.fillStyle = '#c6cfc0';
      ctx.fillRect(x + i * 1.5, y - 1.5, 0.8, 0.6);
    }
  });
  add(benches, (ctx, x, y) => {
    line(ctx, [x - 1, y], [x - 1, y - 1.5], '#46564b', 0.8);
    line(ctx, [x + 2, y], [x + 2, y - 1.5], '#46564b', 0.8);
    line(ctx, [x - 1.5, y - 1.5], [x + 2.5, y - 1.5], '#ad8157');
  });
  add(greySignals, (ctx, x, y) => {
    line(ctx, [x, y], [x, y - 4], '#666b60', 0.8);
    ctx.fillStyle = '#3b4740';
    ctx.fillRect(x - 0.55, y - 5, 1.4, 2.8);
  });
  return objects;
}
