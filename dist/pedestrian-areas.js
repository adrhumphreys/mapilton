// Each crop origin is registered to the LINZ survey in local east/south metres.
export function surveyLocation([east, south]) {
  return ([x, y]) => [
    east + x * 0.4050399 - y * 0.2167978,
    south + x * 0.1474225 + y * 0.5956469,
  ];
}

export function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function line(ctx, a, b, colour, width) {
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.lineTo(...b);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function paintParkingRows(ctx, at, rows, occupancy, skipBay) {
  const colours = ['#d7d9ce', '#a4b4b6', '#4d626d', '#aa5c50', '#e6d8ba', '#343d43'];
  ctx.save();
  ctx.lineCap = 'butt';
  rows.forEach(([a, b, sides], row) => {
    const start = at(a), end = at(b);
    const dx = end[0] - start[0], dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    const normal = [-dy / length, dx / length];
    const count = Math.max(1, Math.round(length / 1.85));
    for (const side of sides === 2 ? [-1, 1] : [sides]) {
      const offset = (point, distance) => point.map((value, i) => value + distance * normal[i] * side);
      for (let bay = 0; bay <= count; bay++) {
        if (skipBay?.(mix(a, b, (bay + 0.5) / count))) continue;
        const edge = mix(start, end, bay / count);
        line(ctx, offset(edge, 0.35), offset(edge, 2.7), '#e2e0cbaf', 0.36);
        if (bay === count || ((bay * 17 + row * 7 + side * 3 + 11) % 11) / 11 >= occupancy) continue;
        const centre = offset(mix(start, end, (bay + 0.5) / count), 1.52);
        ctx.save();
        ctx.translate(...centre);
        ctx.rotate(Math.atan2(normal[1] * side, normal[0] * side));
        ctx.fillStyle = '#333c41a8';
        ctx.fillRect(-1.15, -0.47, 2.62, 1.35);
        ctx.fillStyle = colours[(row * 3 + bay * 7 + side + 1) % colours.length];
        ctx.fillRect(-1.3, -0.66, 2.45, 1.14);
        ctx.fillStyle = '#617781';
        ctx.fillRect(0.38, -0.59, 0.36, 0.99);
        ctx.restore();
      }
    }
  });
  ctx.restore();
}

const universityWest = surveyLocation([2342.99427, -766.15153]);
const universityEast = surveyLocation([2662.58502, -1014.08964]);
const gardenPlace = surveyLocation([-424.87866, -748.25147]);
const claudelandsBridge = surveyLocation([-318.53128, -1141.25932]);

// Each group stands on an open paved area or a path traced from the orthophoto.
export const gatheringSpots = [
  [gardenPlace, [[426, 287], [447, 305], [389, 386], [340, 407]]],
  [universityWest, [[792, 179], [927, 209], [995, 204]]],
  [universityEast, [[835, 722], [907, 690], [966, 721]]],
  [claudelandsBridge, [[518, 220]]],
].flatMap(([locate, points]) => points.map(locate));

const sites = [
  {
    locate: universityWest,
    occupancy: 0.14,
    rows: [
      [[386, 608], [461, 484], 2], [[432, 616], [507, 491], 2],
      [[478, 617], [546, 505], 2], [[522, 622], [589, 516], 2],
      [[564, 624], [628, 531], 2], [[609, 626], [669, 545], 2],
      [[652, 623], [699, 558], 2], [[707, 623], [732, 572], -1],
      [[369, 403], [406, 357], 1], [[407, 414], [447, 365], 2],
      [[445, 425], [484, 377], 1],
    ],
    walks: [
      { points: [[698, 135], [735, 157], [777, 171], [821, 181], [872, 182], [921, 167]], width: 1.25 },
      { points: [[835, 182], [835, 220]], width: 1.35 },
      { points: [[924, 169], [927, 218], [965, 220], [996, 206], [1027, 201], [1073, 185]], width: 1.35 },
    ],
  },
  {
    locate: universityEast,
    occupancy: 0.18,
    rows: [
      [[949, 277], [998, 294], 2], [[944, 291], [992, 310], -1],
      [[1320, 489], [1318, 541], -1], [[1356, 489], [1357, 546], 1],
    ],
    walks: [
      { points: [[567, 600], [637, 580], [686, 555], [733, 525], [768, 492], [762, 463]], width: 1.25 },
      { points: [[782, 735], [829, 722], [865, 706], [907, 690], [942, 686]], width: 1.75 },
      { points: [[942, 686], [968, 701], [985, 728], [985, 755]], width: 1.3 },
    ],
  },
  {
    locate: gardenPlace,
    occupancy: 0.25,
    rows: [
      [[454, 557], [533, 583], 2], [[436, 581], [515, 607], 2],
      [[427, 599], [490, 619], 1], [[571, 93], [622, 109], -1],
    ],
    walks: [
      { points: [[169, 368], [227, 363], [255, 370], [281, 383], [311, 405], [350, 415]], width: 2.1 },
      { points: [[395, 286], [427, 276], [457, 277], [483, 260], [508, 248]], width: 1.1 },
    ],
    plaza: [
      [[238, 359], [286, 374], [324, 371], [353, 354], [382, 324], [377, 310],
        [424, 252], [446, 237], [474, 242], [501, 256], [521, 271], [487, 294],
        [460, 331], [437, 371], [397, 409], [352, 423], [313, 411], [266, 394], [222, 377]],
      [[307, 353], [323, 325], [349, 309], [383, 307], [410, 328], [398, 354],
        [370, 375], [336, 385], [311, 373]],
    ],
  },
  {
    locate: claudelandsBridge,
    occupancy: 0.13,
    rows: [
      [[345, 216], [412, 161], 2], [[371, 231], [440, 173], 2],
      [[399, 246], [446, 206], 2], [[435, 253], [473, 224], 1],
      [[407, 129], [466, 83], 1], [[431, 143], [480, 103], 1],
    ],
    walks: [
      { points: [[477, 269], [494, 243], [519, 220], [541, 202], [561, 173]], width: 1.1 },
    ],
  },
];

function paintPlaza(ctx, at, rings) {
  ctx.save();
  ctx.beginPath();
  for (const ring of rings) {
    const [start, ...points] = ring.map(at);
    ctx.moveTo(...start);
    for (const point of points) ctx.lineTo(...point);
    ctx.closePath();
  }
  ctx.clip('evenodd');
  const [x0, y0] = at([210, 225]), [x1, y1] = at([530, 430]);
  ctx.fillStyle = '#bd9177d9';
  ctx.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  for (let x = 180; x < 650; x += 25) {
    line(ctx, at([x, 225]), at([x - 127, 430]), '#ecd2aa92', 0.54);
  }
  for (let y = 180; y < 450; y += 19) {
    line(ctx, at([208, y]), at([530, y + 80]), '#ecd2aa92', 0.54);
  }
  ctx.restore();
}

export function paintPedestrianAreas(ctx, project) {
  for (const { locate, rows, occupancy, walks, plaza } of sites) {
    const at = point => project(...locate(point));
    if (plaza) paintPlaza(ctx, at, plaza);
    paintParkingRows(ctx, at, rows, occupancy);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const { points, width } of walks) {
      ctx.beginPath();
      const [start, ...rest] = points.map(at);
      ctx.moveTo(...start);
      for (const point of rest) ctx.lineTo(...point);
      ctx.strokeStyle = '#837e6c9c';
      ctx.lineWidth = width + 0.65;
      ctx.stroke();
      ctx.strokeStyle = '#d7c6a6';
      ctx.lineWidth = width;
      ctx.stroke();
    }
    ctx.restore();
  }
}
