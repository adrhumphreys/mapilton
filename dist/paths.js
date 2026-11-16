export function measure(points) {
  const segments = [];
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 0.01) continue;
    segments.push({ a, b, start: distance, end: distance + length, length });
    distance += length;
  }
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  return { segments, distance, bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

export function locate({ segments }, offset) {
  let low = 0, high = segments.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (segments[middle].end < offset) low = middle + 1;
    else high = middle;
  }
  const { a, b, start, length } = segments[low];
  const travelled = offset - start;
  const dx = (b[0] - a[0]) / length, dy = (b[1] - a[1]) / length;
  return [a[0] + dx * travelled, a[1] + dy * travelled, dx, dy];
}

export function nearest({ segments }, [x, y], within) {
  let best = null;
  for (const { a, b, start, length } of segments) {
    const dx = (b[0] - a[0]) / length, dy = (b[1] - a[1]) / length;
    const t = Math.max(0, Math.min(length, (x - a[0]) * dx + (y - a[1]) * dy));
    const cx = a[0] + dx * t, cy = a[1] + dy * t;
    const gap = Math.hypot(x - cx, y - cy);
    if (gap >= within) continue;
    within = gap;
    best = { offset: start + t, gap, x: cx, y: cy, dx, dy, side: Math.sign((x - a[0]) * dy - (y - a[1]) * dx) };
  }
  return best;
}

export function hash(a, b = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
