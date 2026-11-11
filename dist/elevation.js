// An elevation grid in the same screen coordinates as the flat ground.
export function createElevation(grid) {
  const { left, top, width, height, step } = grid;
  const raw = Uint8Array.from(atob(grid.decimetres), character => character.charCodeAt(0));
  const values = new DataView(raw.buffer);
  const right = left + (width - 1) * step;
  const bottom = top + (height - 1) * step;
  const sample = (x, y) => values.getInt16((y * width + x) * 2, true) * 0.073;
  function lift(x, y) {
    const col = (Math.max(left, Math.min(right, x)) - left) / step;
    const row = (Math.max(top, Math.min(bottom, y)) - top) / step;
    const i = Math.min(width - 2, Math.floor(col));
    const j = Math.min(height - 2, Math.floor(row));
    const u = col - i, v = row - j;
    const upper = sample(i, j) * (1 - u) + sample(i + 1, j) * u;
    const lower = sample(i, j + 1) * (1 - u) + sample(i + 1, j + 1) * u;
    return upper * (1 - v) + lower * v;
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

  function paintShade(context) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const painter = canvas.getContext('2d');
    const shade = painter.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const north = Math.max(0, y - 2), south = Math.min(height - 1, y + 2);
      for (let x = 0; x < width; x++) {
        const west = Math.max(0, x - 2), east = Math.min(width - 1, x + 2);
        const across = (sample(east, y) - sample(west, y)) / ((east - west) * step * 0.73);
        const depth = (sample(x, south) - sample(x, north)) * 0.68 / ((south - north) * step * 0.73);
        // Light from the upper left, with weaker ambient light on steeper slopes.
        const norm = Math.hypot(1, across, depth);
        const light = (0.76 + 0.48 * across + 0.44 * depth) / norm - 0.76;
        const offset = (y * width + x) * 4;
        shade.data[offset] = light > 0 ? 249 : 43;
        shade.data[offset + 1] = light > 0 ? 230 : 58;
        shade.data[offset + 2] = light > 0 ? 174 : 49;
        shade.data[offset + 3] = Math.min(light > 0 ? 57 : 125, Math.abs(light) * 205);
      }
    }
    painter.putImageData(shade, 0, 0);
    context.drawImage(canvas, left - step / 2, top - step / 2, width * step, height * step);
  }

  function paintGround(context) {
    const w = right - left, h = bottom - top;
    const source = context.getImageData(left, top, w, h);
    const target = context.createImageData(w, h);
    const input = new Uint32Array(source.data.buffer);
    const output = new Uint32Array(target.data.buffer);
    for (let x = 0; x < w; x++) {
      let projected = -lift(x + left, top);
      for (let y = 0; y < Math.min(h, Math.ceil(projected)); y++) {
        output[y * w + x] = input[x];
      }
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
      for (let y = Math.max(0, Math.ceil(projected)); y < h; y++) {
        output[y * w + x] = input[(h - 1) * w + x];
      }
    }
    context.putImageData(target, left, top);
  }

  return { lift, point, route, paintShade, paintGround };
}
