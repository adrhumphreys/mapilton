// A local elevation grid in the same screen coordinates as the flat ground.
export function createElevation(grid) {
  const { left, top, width, height, step } = grid;
  const raw = Uint8Array.from(atob(grid.decimetres), character => character.charCodeAt(0));
  const values = new DataView(raw.buffer);
  const right = left + (width - 1) * step;
  const bottom = top + (height - 1) * step;
  const sample = (x, y) => values.getInt16((y * width + x) * 2, true) * 0.073;
  function lift(x, y) {
    const edge = Math.min(x - left, right - x, y - top, bottom - y);
    if (edge <= 0) return 0;
    const col = (x - left) / step, row = (y - top) / step;
    const i = Math.floor(col), j = Math.floor(row);
    const u = col - i, v = row - j;
    const upper = sample(i, j) * (1 - u) + sample(i + 1, j) * u;
    const lower = sample(i, j + 1) * (1 - u) + sample(i + 1, j + 1) * u;
    const taper = Math.min(1, edge / 100);
    return (upper * (1 - v) + lower * v) * taper * taper * (3 - 2 * taper);
  }

  function point([x, y]) {
    return [x, y - lift(x, y)];
  }

  function route(points, bridge) {
    if (bridge) {
      const a = points[0], b = points.at(-1);
      const from = lift(...a), to = lift(...b);
      const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return points.map(([x, y]) => {
        const fraction = span ? Math.min(1, Math.hypot(x - a[0], y - a[1]) / span) : 0;
        return [x, y - (from * (1 - fraction) + to * fraction)];
      });
    }
    const result = [point(points[0])];
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1], [bx, by] = points[i];
      const intersects = Math.max(ax, bx) >= left && Math.min(ax, bx) <= right
        && Math.max(ay, by) >= top && Math.min(ay, by) <= bottom;
      const divisions = intersects ? Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4)) : 1;
      for (let j = 1; j <= divisions; j++) {
        result.push(point([ax + (bx - ax) * j / divisions, ay + (by - ay) * j / divisions]));
      }
    }
    return result;
  }

  function paintGround(context) {
    const w = right - left + 1, h = bottom - top + 1;
    const source = context.getImageData(left, top, w, h);
    const target = context.createImageData(w, h);
    const input = new Uint32Array(source.data.buffer);
    const output = new Uint32Array(target.data.buffer);
    for (let x = 0; x < w; x++) {
      let projected = 0;
      for (let y = 1; y < h; y++) {
        const next = y - lift(x + left, y + top);
        // Scan back to front so near slopes cover lower ground behind them.
        const start = Math.max(0, Math.ceil(projected));
        const end = Math.min(h - 1, Math.ceil(next) - 1);
        for (let dest = start; dest <= end; dest++) {
          const sourceRow = dest - projected < (next - projected) / 2 ? y - 1 : y;
          output[dest * w + x] = input[sourceRow * w + x];
        }
        projected = next;
      }
      output[(h - 1) * w + x] = input[(h - 1) * w + x];
    }
    context.putImageData(target, left, top);
  }

  return { lift, point, route, paintGround };
}
