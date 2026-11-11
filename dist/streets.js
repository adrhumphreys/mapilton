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

export function paintCrossings(ctx, project, routes, details) {
  const roads = routes.filter(route => route.size >= 6 && !route.bridge).map(route => ({
    ...route,
    left: Math.min(...route.flat.map(point => point[0])) - 7,
    right: Math.max(...route.flat.map(point => point[0])) + 7,
    top: Math.min(...route.flat.map(point => point[1])) - 7,
    bottom: Math.max(...route.flat.map(point => point[1])) + 7,
  }));
  for (const [kind, east, south, markings] of details) {
    if (kind !== 'crossing') continue;
    const [x, y] = project(east, south);
    let nearest, distance = 7;
    for (const route of roads) {
      if (x < route.left || x > route.right || y < route.top || y > route.bottom) continue;
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
    if (markings === 'zebra') {
      for (let offset = -half + 0.7; offset < half; offset += 1.8) {
        const mx = cx - dy * offset, my = cy + dx * offset;
        line(ctx, [mx - dx * 1.45, my - dy * 1.45], [mx + dx * 1.45, my + dy * 1.45], '#eee6ce', 0.85);
      }
    } else {
      for (const offset of [-1.7, 1.7]) {
        const mx = cx + dx * offset, my = cy + dy * offset;
        line(ctx, [mx - dy * half, my + dx * half], [mx + dy * half, my - dx * half], '#e9e2c5', 0.95);
      }
    }
    for (const side of [-1, 1]) {
      const ex = cx - dy * side * (half + 0.8), ey = cy + dx * side * (half + 0.8);
      ctx.fillStyle = '#d6ab65';
      ctx.fillRect(ex - 1, ey - 0.65, 2, 1.3);
    }
  }
}

export function streetFurniture(project, elevation, details) {
  const objects = [];
  const add = (kind, draw) => {
    for (const [feature, east, south, variant] of details) {
      if (feature !== kind) continue;
      const [x, y] = elevation.point(project(east, south));
      objects.push({ y, draw: ctx => draw(ctx, Math.round(x), Math.round(y), variant) });
    }
  };
  add('bus', (ctx, x, y, shelter) => {
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
  add('bicycle', (ctx, x, y, count) => {
    for (let i = 0; i < count; i++) {
      line(ctx, [x + i * 1.5, y], [x + i * 1.5, y - 1.4], '#697d75', 0.75);
      ctx.fillStyle = '#c6cfc0';
      ctx.fillRect(x + i * 1.5, y - 1.5, 0.8, 0.6);
    }
  });
  add('bench', (ctx, x, y) => {
    line(ctx, [x - 1, y], [x - 1, y - 1.5], '#46564b', 0.8);
    line(ctx, [x + 2, y], [x + 2, y - 1.5], '#46564b', 0.8);
    line(ctx, [x - 1.5, y - 1.5], [x + 2.5, y - 1.5], '#ad8157');
  });
  add('signal', (ctx, x, y) => {
    line(ctx, [x, y], [x, y - 4], '#666b60', 0.8);
    ctx.fillStyle = '#3b4740';
    ctx.fillRect(x - 0.55, y - 5, 1.4, 2.8);
  });
  add('lamp', (ctx, x, y) => {
    line(ctx, [x, y], [x, y - 6.5], '#525e55', 0.75);
    line(ctx, [x, y - 6.5], [x + 2, y - 6.9], '#525e55', 0.8);
    ctx.fillStyle = '#eee0ae';
    ctx.fillRect(x + 1, y - 7, 1.5, 0.65);
  });
  add('bin', (ctx, x, y) => {
    ctx.fillStyle = '#3e5548';
    ctx.fillRect(x, y - 2, 1.6, 2);
    ctx.fillStyle = '#87937d';
    ctx.fillRect(x - 0.2, y - 2.4, 2, 0.6);
  });
  add('picnic', (ctx, x, y) => {
    polygon(ctx, [[x - 2.5, y], [x + 2, y - 1.4], [x + 3.5, y], [x - 1, y + 1.4]], '#62594778');
    line(ctx, [x - 1.5, y - 0.8], [x - 1.5, y - 2.2], '#604f3a', 0.7);
    line(ctx, [x + 2.1, y - 1.6], [x + 2.1, y - 3.1], '#604f3a', 0.7);
    line(ctx, [x - 2, y - 2.4], [x + 2.4, y - 3.5], '#ac8759', 1.15);
    line(ctx, [x - 1, y - 0.8], [x + 3, y - 1.8], '#9c774f', 0.8);
  });
  add('fountain', (ctx, x, y) => {
    ctx.fillStyle = '#657d77';
    ctx.fillRect(x, y - 1.9, 0.9, 1.9);
    ctx.fillStyle = '#c0c8b4';
    ctx.fillRect(x - 0.7, y - 2.4, 2.2, 0.75);
  });
  return objects;
}
