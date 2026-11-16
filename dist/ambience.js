const binSize = 128;
const cloudSpan = [2600, 1700];
const cloudResolution = 8;

const leafy = ([r, g, b, a]) => a > 200 && g - r > 14 && g >= b - 4;

function exposed({ left, top, width, height }, pixel) {
  let leaves = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const sample = pixel(left + Math.round(col * (width - 1) / 4), top + Math.round(row * (height - 1) / 2));
      if (leafy(sample)) leaves++;
      else if (sample[3] > 40) return false;
    }
  }
  return leaves >= 4;
}

export function createSway(trees, pixel) {
  const bins = new Map();
  for (const tree of trees) {
    if (!exposed(tree, pixel)) continue;
    const key = Math.floor(tree.left / binSize) * 4096 + Math.floor(tree.top / binSize);
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push(tree);
  }
  return bins;
}

export function paintSway(ctx, bins, foreground, time, bounds) {
  for (let col = Math.floor(bounds.left / binSize) - 1; col <= Math.floor(bounds.right / binSize); col++) {
    for (let row = Math.floor(bounds.top / binSize) - 1; row <= Math.floor(bounds.bottom / binSize); row++) {
      for (const { left, top, width, height, seed } of bins.get(col * 4096 + row) ?? []) {
        if (left > bounds.right || left + width < bounds.left || top > bounds.bottom || top + height < bounds.top) continue;
        const gust = Math.sin(time * 0.8 - left * 0.0045 - top * 0.0016) * 0.65 + Math.sin(time * 2.1 + seed * 6) * 0.35;
        const shift = gust > 0.5 ? 1 : gust < -0.8 ? -1 : 0;
        if (shift) ctx.drawImage(foreground, left, top, width, height, left + shift, top, width, height);
      }
    }
  }
}

export function createClouds(random) {
  const [w, h] = cloudSpan.map(value => value / cloudResolution);
  const tile = document.createElement('canvas');
  tile.width = w;
  tile.height = h;
  const paint = tile.getContext('2d');
  for (let cloud = 0; cloud < 9; cloud++) {
    const cx = random() * w, cy = random() * h, size = 18 + random() * 30;
    for (let puff = 0; puff < 6; puff++) {
      const px = cx + (random() - 0.5) * size * 1.6;
      const py = cy + (random() - 0.5) * size * 0.6;
      const radius = size * (0.4 + random() * 0.5);
      for (const ox of [-w, 0, w]) {
        for (const oy of [-h, 0, h]) {
          paint.save();
          paint.translate(px + ox, py + oy);
          paint.scale(1, 0.62);
          const shade = paint.createRadialGradient(0, 0, 0, 0, 0, radius);
          shade.addColorStop(0, 'rgba(18, 42, 48, 0.15)');
          shade.addColorStop(1, 'rgba(18, 42, 48, 0)');
          paint.fillStyle = shade;
          paint.fillRect(-radius, -radius, radius * 2, radius * 2);
          paint.restore();
        }
      }
    }
  }
  return tile;
}

export function paintClouds(ctx, tile, [driftX, driftY], bounds, strength) {
  if (strength <= 0.02) return;
  const [w, h] = cloudSpan;
  const ox = (driftX % w + w) % w, oy = (driftY % h + h) % h;
  ctx.save();
  ctx.globalAlpha = Math.min(1, strength);
  ctx.imageSmoothingEnabled = true;
  for (let x = Math.floor((bounds.left - ox) / w) * w + ox; x < bounds.right; x += w) {
    for (let y = Math.floor((bounds.top - oy) / h) * h + oy; y < bounds.bottom; y += h) {
      ctx.drawImage(tile, x, y, w, h);
    }
  }
  ctx.restore();
}
