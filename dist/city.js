// The authored plan uses east/south coordinates. Rendering foreshortens depth
// and keeps building walls vertical so all landmarks share the same camera.
export const width = 1280;
export const height = 800;
export const project = (x, y, z = 0) => [39 + x + y * 0.25, 229 - x * 0.19 + y * 0.66 - z];

export const places = [
  { name: 'Lake Rotoroa', x: 281, y: 656, text: 'Hamilton Lake sits southwest of the central city, with the Lake Domain along its shores.' },
  { name: 'Seddon Park', x: 353, y: 350, text: 'A cricket ground west of the central city.' },
  { name: 'Garden Place', x: 500, y: 473, text: 'A public square in the central city, west of the Waikato River.' },
  { name: 'Claudelands', x: 738, y: 287, text: 'The events centre and surrounding parkland sit east of the Waikato River.' },
  { name: 'Hamilton Gardens', x: 768, y: 841, text: 'Enclosed gardens and open parkland sit beside a bend in the Waikato River.' },
];

function randomSource(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const riverNodes = [481, 504, 568, 623, 627, 585, 588, 634, 688, 736, 719, 686, 748];
const river = y => {
  const pos = Math.max(0, Math.min(11.9999, y / 80));
  const i = Math.floor(pos);
  const t = pos - i;
  return riverNodes[i] + (riverNodes[i + 1] - riverNodes[i]) * (t * t * (3 - 2 * t));
};
const riverWidth = y => 36 + 8 * Math.sin(y / 89);
const lake = (x, y) => Math.hypot((x - 275 + (y - 669) * 0.20) / 114, (y - 669) / 144);
const xs = [30, 102, 180, 258, 336, 415, 476, 525, 682, 749, 819, 893, 972, 1030];
const ys = [26, 105, 183, 263, 342, 410, 473, 539, 618, 694, 773, 851, 932];
const bridges = [183, 410, 539, 851];

export function paintCity(ctx) {
  const random = randomSource(3241);
  const pick = items => items[Math.floor(random() * items.length)];
  function polygon(points, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      const [px, py] = project(x, y);
      if (i === 0) ctx.moveTo(Math.round(px), Math.round(py));
      else ctx.lineTo(Math.round(px), Math.round(py));
    });
    ctx.closePath();
    ctx.fill();
  }
  function rect(x, y, w, d, fill) {
    polygon([[x, y], [x + w, y], [x + w, y + d], [x, y + d]], fill);
  }
  function dot(x, y, w, h, color, z = 0) {
    const [px, py] = project(x, y, z);
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(px), Math.round(py), w, h);
  }
  function water(x, y, margin = 0) {
    return Math.abs(x - river(y)) < riverWidth(y) + margin || lake(x, y) < 1 + margin / 125;
  }
  function road(x, y) {
    return xs.some(value => Math.abs(x - value) < 8) || ys.some(value => Math.abs(y - value) < 8);
  }
  function park(x, y) {
    return Math.abs(x - 353) < 49 && Math.abs(y - 350) < 49
      || x > 706 && x < 806 && y > 236 && y < 331
      || x > 726 && x < 842 && y > 775 && y < 896
      || Math.hypot(x - 500, y - 473) < 27;
  }

  rect(0, 0, 1040, 952, '#a0b473');
  for (let y = 0; y < 952; y += 8) {
    for (let x = 0; x < 1040; x += 8) {
      const grass = ['#a0b473', '#a2b675', '#9caf6e', '#9fb16d', '#a7b877'];
      if (water(x + 4, y + 4, 10)) grass.splice(0, grass.length, '#789b62', '#7c9f66');
      rect(x, y, 8, 8, pick(grass));
    }
  }
  function riverStrip(extra, colour) {
    const left = [], right = [];
    for (let y = 0; y <= 952; y += 4) {
      left.push([river(y) - riverWidth(y) - extra, y]);
      right.push([river(y) + riverWidth(y) + extra, y]);
    }
    polygon(left.concat(right.reverse()), colour);
  }
  function lakeShape(scale, colour) {
    const points = Array.from({ length: 108 }, (_, i) => {
      const angle = i * Math.PI / 54;
      const dy = Math.sin(angle) * 144 * scale;
      return [275 + Math.cos(angle) * 114 * scale - dy * 0.2, 669 + dy];
    });
    polygon(points, colour);
  }
  riverStrip(4, '#c0b77a');
  riverStrip(0, '#398a89');
  riverStrip(-7, '#408f91');
  lakeShape(1.035, '#bdba7a');
  lakeShape(1, '#438b8e');
  lakeShape(0.91, '#489699');

  for (let i = 0; i < 8200; i++) {
    const x = random() * 1034, y = random() * 947;
    const onWater = water(x, y, -4);
    dot(x, y, 1 + Math.floor(random() * (onWater ? 10 : 4)), 1,
      onWater ? pick(['#63a6a1', '#54a1a0', '#3c8588']) : pick(['#8da469', '#afbe80', '#a6b979']));
  }

  for (const x of xs) {
    for (let y = 0; y < 950; y += 4) {
      if (water(x, y, 10) || park(x, y)) continue;
      rect(x - 7, y, 14, 4, '#d4c7a4');
      rect(x - 5, y, 10, 4, '#888b81');
      if (y % 16 === 0) rect(x, y, 1, 4, '#d1c49e');
    }
  }
  for (const y of ys) {
    for (let x = 0; x < 1040; x += 4) {
      const bridge = bridges.includes(y) && Math.abs(x - river(y)) < riverWidth(y) + 19;
      if (!bridge && (water(x, y, 10) || park(x, y))) continue;
      rect(x, y - 7, 4, 14, bridge ? '#ede1bb' : '#d5c8a6');
      rect(x, y - 5, 4, 10, bridge ? '#717a74' : '#8a8c82');
      if (x % 16 === 0) rect(x, y, 4, 1, '#d7c8a4');
    }
  }

  // Cricket oval and formal garden beds are drawn flat beneath the scenery.
  function oval(x, y, rx, ry, color) {
    polygon(Array.from({ length: 40 }, (_, i) => {
      const t = i * Math.PI / 20;
      return [x + Math.cos(t) * rx, y + Math.sin(t) * ry];
    }), color);
  }
  oval(353, 351, 44, 45, '#d5ccaa');
  oval(353, 351, 39, 40, '#6b9d5c');
  oval(353, 351, 32, 34, '#79a960');
  rect(350, 340, 6, 22, '#c8b682');
  rect(483, 456, 35, 32, '#d0bc98');
  rect(733, 790, 91, 84, '#c9bd94');
  for (let y = 797; y < 870; y += 18) {
    for (let x = 739; x < 817; x += 19) {
      rect(x, y, 14, 13, '#648b55');
      rect(x + 3, y + 3, 8, 7, pick(['#ae786c', '#a2b360', '#ceb884', '#879d76']));
    }
  }
  oval(799, 885, 22, 10, '#569798');

  const objects = [];
  function building(x, y, w, d, h, roof, wall, shade) {
    objects.push({ order: project(x + w, y + d)[1], draw() {
      const a = project(x, y, h), b = project(x + w, y, h);
      const c = project(x + w, y + d, h), e = project(x, y + d, h);
      function face(points, color) {
        ctx.beginPath();
        for (const [px, py] of points) ctx.lineTo(Math.round(px), Math.round(py));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
      polygon([[x + 4, y + 5], [x + w + 6, y + 5], [x + w + 12, y + d + 9], [x + 9, y + d + 9]], '#738957');
      face([b, c, project(x + w, y + d), project(x + w, y)], shade);
      face([e, c, project(x + w, y + d), project(x, y + d)], wall);
      face([a, b, c, e], roof);
      if (w > 8 && d > 6) {
        face([a, b, project(x + w - 2, y + 2, h), project(x + 2, y + 2, h)], '#fff4cc60');
        for (let z = 4; z < h - 2; z += 5) {
          for (let dx = 3; dx < w - 2; dx += 5) dot(x + dx, y + d, 2, 2, '#47615e', z);
        }
        if (h > 13) dot(x + 4, y + 4, 4, 2, '#b9b3a3', h + 1);
      }
    } });
  }
  for (let yi = 0; yi < ys.length - 1; yi++) {
    for (let xi = 0; xi < xs.length - 1; xi++) {
      for (let y = ys[yi] + 13; y < ys[yi + 1] - 15; y += 17) {
        for (let x = xs[xi] + 13; x < xs[xi + 1] - 17; x += 18) {
          const w = 7 + Math.floor(random() * 7), d = 7 + Math.floor(random() * 6);
          if (random() < 0.17 || water(x + w / 2, y + d / 2, 16) || park(x + w / 2, y + d / 2)) continue;
          const central = x > 405 && x < river(y) - 25 && y > 292 && y < 620;
          rect(x - 2, y - 2, w + 5, d + 5, pick(['#b4ba85', '#bdb68c', '#a4b47b']));
          building(x, y, w, d, central ? 8 + Math.floor(random() * 24) : 4 + Math.floor(random() * 8),
            pick(['#b56e57', '#d48d71', '#74898b', '#9aa2a1', '#d6c6a9', '#a38473', '#c9b5a0']),
            pick(['#dfc39c', '#ede1c2', '#bbad97']), '#81796a');
        }
      }
    }
  }
  building(737, 278, 48, 24, 17, '#9faea7', '#dfddbd', '#667e7b');
  building(741, 268, 36, 13, 9, '#758b87', '#c2c8ae', '#60746e');
  building(322, 373, 46, 8, 8, '#677d80', '#c7be9f', '#6a776c');
  building(771, 822, 14, 14, 8, '#a76d57', '#e2c5a5', '#88735d');

  for (let i = 0; i < 5600; i++) {
    const x = 4 + random() * 1030, y = 5 + random() * 940;
    if (water(x, y, 4) || road(x, y) || park(x, y)) continue;
    const bank = water(x, y, 24);
    if (!bank && random() < 0.64) continue;
    const s = Math.floor(random() * 5) + 2;
    const light = pick(['#769b54', '#6a944d', '#84a05a', '#5a864e']);
    objects.push({ order: project(x, y)[1], draw() {
      dot(x, y, s + 4, 2, '#7d955b');
      dot(x, y, 2, 4, '#786d50', 3);
      dot(x - s / 2, y, s + 2, s, '#496f48', s + 3);
      dot(x - s / 2 - 1, y, s + 1, s, light, s + 5);
      dot(x - s / 2, y, Math.max(2, s - 1), 2, '#98aa62', s + 5);
    } });
  }
  objects.sort((a, b) => a.order - b.order).forEach(object => object.draw());
}

export function paintMovement(ctx, time) {
  for (let i = 0; i < 48; i++) {
    const y = (i * 37.89 + time * (8 + i % 4)) % 940;
    const [x, py] = project(river(y) + Math.sin(i * 7) * 23, y);
    ctx.fillStyle = i % 3 ? '#78b8ad95' : '#a8cdc58c';
    ctx.fillRect(Math.round(x), Math.round(py), 3 + i % 6, 1);
  }
  for (let i = 0; i < 24; i++) {
    const crossing = bridges[i % bridges.length];
    const westbound = Math.floor(i / bridges.length) % 2 === 1;
    const y = crossing + (westbound ? 3 : -3);
    const offset = (i * 53.1 + time * 24) % 206;
    const x = river(crossing) - 103 + (westbound ? 206 - offset : offset);
    const [px, py] = project(x, y);
    ctx.fillStyle = '#404c48';
    ctx.fillRect(Math.round(px), Math.round(py), 5, 3);
    ctx.fillStyle = ['#f4e4be', '#a64f43', '#576b7a', '#d4aa57'][Math.floor(i / 4) % 4];
    ctx.fillRect(Math.round(px), Math.round(py) - 1, 4, 2);
  }
}
