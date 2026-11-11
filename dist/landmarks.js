// Footprints and street furniture coordinates are from the bundled OSM extract.
export const landmarkBuildings = {
  '573.7,15.5,594.7,10.2,34': 'made',
  '648.1,-177.8,612.4,-167.6,13': 'cathedral',
  '44.3,-289.5,22.4,-264.7,22': 'museum',
  '-337.7,-451.6,-314.7,-468.7,13': 'library',
  '304.6,-1311.9,248.7,-1283.6,11': 'arena',
  '20.8,16,19,20,17': 'st-peter',
  '-38.4,-258.3,-20.3,-233.8,5': 'artspost',
  '1425.6,1517.5,1455.1,1553.9,16': 'gardens-pavilion',
  '-1128.1,-645.2,-1129.3,-641,16': 'seddon-pavilion',
  '-4501.8,-4696.9,-4510.8,-4706.5,38': 'te-awa',
};

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
export function paintLandmark(ctx, kind, ground, roof) {
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

  if (kind !== 'cathedral') {
    paintCityLandmark(ctx, kind, ground, roof);
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

function paintGlazing(ctx, a, b, height, count, glass, frame) {
  polygon(ctx, [a, b, raise(b, height), raise(a, height)], glass);
  for (let i = 0; i <= count; i++) {
    const p = mix(a, b, i / count);
    line(ctx, p, raise(p, height), frame, 0.65);
  }
}

function paintCityLandmark(ctx, kind, ground, roof) {
  if (kind === 'artspost') {
    // Victoria Street and the short return towards Hood Street.
    for (const [i, j, bays] of [[0, 1, 6], [1, 2, 3]]) {
      const a = ground[i], b = ground[j], upperA = roof[i], upperB = roof[j];
      const baseA = mix(upperA, a, 0.96), baseB = mix(upperB, b, 0.96);
      polygon(ctx, [upperA, upperB, baseB, baseA], i === 0 ? '#d8a15e' : '#b98451');
      for (const fraction of [0.08, 0.47, 0.91]) {
        line(ctx, mix(upperA, baseA, fraction), mix(upperB, baseB, fraction), '#c9c7b6', 1.1);
      }
      for (let k = 0; k <= bays; k++) {
        const lower = mix(baseA, baseB, k / bays), upper = mix(upperA, upperB, k / bays);
        line(ctx, lower, upper, '#a8ad9e', 0.8);
        if (k === bays) continue;
        const sill = mix(baseA, baseB, (k + 0.5) / bays);
        const top = mix(upperA, upperB, (k + 0.5) / bays);
        for (const height of [0.22, 0.67]) {
          const p = mix(sill, top, height);
          ctx.fillStyle = '#e1d9bb';
          ctx.fillRect(p[0] - 1.05, p[1] - 1.3, 2.1, 2.2);
          ctx.fillStyle = '#566c6a';
          ctx.fillRect(p[0] - 0.58, p[1] - 1.1, 1.16, 1.7);
        }
      }
    }
    const roofCentre = mix(roof[0], roof[2], 0.44);
    line(ctx, roofCentre, raise(roofCentre, 5.7), '#dbd8bf', 0.75);
    polygon(ctx, [raise(roofCentre, 5.7), [roofCentre[0] + 3.4, roofCentre[1] - 5.1],
      [roofCentre[0] + 3.4, roofCentre[1] - 3.5], raise(roofCentre, 4.2)], '#465f7b');
    return;
  }
  if (kind === 'gardens-pavilion') {
    const a = ground[14], b = ground[12];
    paintGlazing(ctx, a, b, 3.2, 11, '#627c73', '#be9870');
    const veranda = [a, b].map(([x, y]) => [x - 2.4, y + 2.4]);
    polygon(ctx, [raise(a, 3.8), raise(b, 3.8), raise(veranda[1], 3.8),
      raise(veranda[0], 3.8)], '#a69f82');
    line(ctx, raise(veranda[0], 3.7), raise(veranda[1], 3.7), '#5e6255', 1.2);
    for (const t of [0.03, 0.23, 0.43, 0.63, 0.82, 0.97]) {
      const p = mix(...veranda, t);
      line(ctx, p, raise(p, 3.7), '#9b7754', 0.8);
    }
    const ridgeA = raise(mix(roof[0], roof[14], 0.53), 1.6);
    const ridgeB = raise(mix(roof[4], roof[11], 0.48), 2.4);
    polygon(ctx, [roof[0], roof[1], roof[4], ridgeB, ridgeA], '#777f71');
    polygon(ctx, [ridgeA, ridgeB, roof[11], roof[12], roof[14]], '#929684');
    line(ctx, ridgeA, ridgeB, '#c1be9f', 0.75);
    return;
  }
  if (kind === 'seddon-pavilion') {
    const a = ground[12], b = ground[8];
    paintGlazing(ctx, a, b, 4.5, 10, '#607677', '#b3b7a1');
    const edge = [a, b].map(([x, y]) => [x + 3.1, y - 0.7]);
    polygon(ctx, [raise(a, 5.2), raise(b, 5.2), raise(edge[1], 5.2),
      raise(edge[0], 5.2)], '#b2b7a6');
    for (const z of [0.8, 1.55, 2.3]) {
      line(ctx, raise(edge[0], z), raise(edge[1], z), '#9b9d89', 0.9);
    }
    return;
  }
  if (kind === 'museum') {
    const ridgeA = raise(mix(roof[0], roof[18], 0.55), 3.3);
    const ridgeB = raise(mix(roof[9], roof[10], 0.58), 4.8);
    polygon(ctx, [roof[0], roof[1], roof[6], roof[9], ridgeB, ridgeA], '#727e7a');
    polygon(ctx, [ridgeA, ridgeB, roof[10], roof[13], roof[15], roof[18]], '#939c91');
    for (const t of [0.18, 0.35, 0.52, 0.69, 0.86]) {
      const ridge = mix(ridgeA, ridgeB, t);
      line(ctx, mix(roof[1], roof[9], t), ridge, '#bac1aa50', 0.7);
      line(ctx, ridge, mix(roof[18], roof[10], t), '#65726c50', 0.7);
    }
    line(ctx, ridgeA, ridgeB, '#c4c8ae', 0.85);
    const a = mix(ground[9], ground[10], 0.25), b = mix(ground[9], ground[10], 0.75);
    paintGlazing(ctx, a, b, 4.2, 4, '#648081', '#b3b2a0');
    line(ctx, raise(a, 4.6), raise(b, 4.6), '#a15a43', 2.1);
    line(ctx, a, raise(a, 4.7), '#a15a43', 1.3);
    line(ctx, b, raise(b, 4.7), '#a15a43', 1.3);
    return;
  }
  if (kind === 'library') {
    const [a, b] = [ground[0], ground[1]];
    paintGlazing(ctx, a, b, 5.1, 9, '#6a8990', '#b7bbb1');
    for (let i = 0; i < 7; i++) {
      const from = raise(mix(a, b, i / 7), 4.7), to = raise(mix(a, b, (i + 1) / 7), 4.7);
      polygon(ctx, [from, [from[0] - 1.4, from[1] - 2.5], to], i % 2 ? '#b37d59' : '#965e43');
    }
    line(ctx, raise(a, 4.7), raise(b, 4.7), '#754b39', 0.85);
    return;
  }
  if (kind === 'arena') {
    const a = ground[1], b = ground[6];
    paintGlazing(ctx, a, b, 6.2, 18, '#567376', '#a4aca5');
    const veil = ['#343e3d', '#697069', '#a57351', '#5b6861', '#a2a39a', '#465550'];
    for (let i = 0; i < veil.length; i++) {
      const z = 6.4 + i * 1.22;
      line(ctx, raise(a, z), raise(b, z), veil[i], 1.2);
    }
    line(ctx, raise(a, 13.8), raise(b, 13.8), '#414947', 1.45);
    const a2 = mix(roof[1], roof[0], 0.15), b2 = mix(roof[6], roof[7], 0.15);
    line(ctx, a2, b2, '#b2b9ac', 1);
    return;
  }

  // St Peter’s existing square bell tower and the pitched nave below it.
  const ridgeA = raise(mix(roof[0], roof[3], 0.5), 4);
  const ridgeB = raise(mix(roof[7], roof[13], 0.5), 5.1);
  polygon(ctx, [roof[0], ridgeA, ridgeB, roof[13], roof[15]], '#7f5244');
  polygon(ctx, [ridgeA, roof[3], roof[4], roof[6], roof[7], ridgeB], '#aa7056');
  line(ctx, ridgeA, ridgeB, '#c3946d', 0.7);
  const corners = [ground[7], ground[8], ground[9], ground[10]];
  const top = corners.map(point => raise(point, 14.9));
  polygon(ctx, [corners[0], corners[1], top[1], top[0]], '#ac9b82');
  polygon(ctx, [corners[1], corners[2], top[2], top[1]], '#978770');
  polygon(ctx, top, '#706c60');
  for (let i = 0; i < 3; i++) {
    line(ctx, top[i], raise(top[i], 1.2), '#d1c1a0', 1.05);
    const window = mix(corners[i], corners[i + 1], 0.5);
    line(ctx, raise(window, 9.3), raise(window, 12), '#4d524a', 1.1);
  }
  line(ctx, raise(top[0], 0.5), raise(top[1], 0.5), '#c5b797', 0.8);
}
