import { line, mix, paintParkingRows, surveyLocation } from './pedestrian-areas.js';

const location = surveyLocation([-4797.1909, -5118.8091]);

function polygon(ctx, points, colour) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

export function paintTeAwaRoof(ctx, project, roofLift) {
  const roof = (point, rise = 0) => {
    const [x, y] = project(...location(point));
    return [x, y - roofLift - rise];
  };
  for (const [points, colour] of [
    [[[274, 204], [440, 218], [422, 310], [260, 294]], '#deded3'],
    [[[612, 211], [687, 235], [669, 273], [605, 259]], '#ced4d1'],
    [[[526, 358], [714, 388], [706, 429], [512, 412]], '#e1ded1'],
    [[[868, 305], [1060, 369], [983, 477], [804, 419]], '#d7d7ca'],
    [[[769, 367], [818, 381], [780, 435], [737, 425]], '#8a9290'],
  ]) polygon(ctx, points.map(point => roof(point)), colour);

  for (const [a, b] of [
    [[286, 222], [405, 232]], [[429, 228], [514, 237]],
    [[547, 329], [622, 343]], [[541, 355], [631, 370]],
    [[630, 369], [709, 390]], [[907, 340], [851, 425]],
    [[931, 349], [876, 433]],
  ]) line(ctx, roof(a), roof(b), '#a9b3ab', 0.52);
  for (const [x, y, length] of [[552, 342, 22], [601, 359, 17], [650, 383, 27], [905, 380, 21]]) {
    const points = [[x, y], [x + length, y + 4], [x + length - 3, y + 10], [x - 3, y + 6]];
    polygon(ctx, points.map(point => roof(point)), '#a5ada6');
    polygon(ctx, points.map(point => roof(point, 0.6)), '#d3d8cc');
  }

  // The ETFE-covered internal street changes direction halfway along the mall.
  const banks = [
    [[374, 260], [637, 282], [850, 347]],
    [[370, 290], [624, 319], [831, 379]],
  ];
  for (let section = 0; section < 2; section++) {
    const [a, b] = banks[0].slice(section);
    const [d, c] = banks[1].slice(section);
    const ridge = t => roof(mix(mix(a, b, t), mix(d, c, t), 0.46), 2.1);
    polygon(ctx, [roof(a), roof(b), ridge(1), ridge(0)], '#b3cbd0');
    polygon(ctx, [ridge(0), ridge(1), roof(c), roof(d)], '#6d919c');
    const ribs = section === 0 ? 16 : 14;
    for (let rib = 0; rib <= ribs; rib++) {
      const t = rib / ribs;
      line(ctx, roof(mix(a, b, t)), ridge(t), '#eef1e5', 0.65);
      line(ctx, ridge(t), roof(mix(d, c, t)), '#bfd5d5', 0.55);
    }
    line(ctx, ridge(0), ridge(1), '#f5eee0', 0.65);
  }
}

export function paintTeAwaEntrance(ctx, ground) {
  const [a, b, c, d] = [[729, 430], [762, 441], [754, 453], [721, 442]]
    .map(point => ground(...location(point)));
  const raise = ([x, y], z) => [x, y - z];
  polygon(ctx, [a, b, raise(b, 4.5), raise(a, 4.5)], '#41616b');
  for (const t of [0.15, 0.36, 0.59, 0.81]) {
    const post = mix(a, b, t);
    line(ctx, post, raise(post, 4.5), '#d5d3bc', 0.55);
  }
  polygon(ctx, [a, b, c, d], '#c4a88c');
  polygon(ctx, [raise(a, 5), raise(b, 5), raise(c, 5), raise(d, 5)], '#b57a4e');
  polygon(ctx, [raise(d, 5), raise(c, 5), raise(c, 3.5), raise(d, 3.5)], '#9e563a');
  for (const post of [c, d]) line(ctx, post, raise(post, 3.5), '#66534c', 0.7);
}

// These centre lines follow surface parking rows visible in the LINZ orthophoto.
const parkingRows = [
  [[85, 507], [218, 549], 1], [[104, 474], [238, 516], 1],
  [[171, 375], [237, 395], 1], [[264, 401], [319, 419], 1],
  [[357, 431], [426, 451], 1], [[415, 554], [466, 494], 2],
  [[473, 578], [527, 505], 2], [[502, 588], [554, 515], 1],
  [[699, 492], [678, 622], 2], [[744, 497], [723, 630], 2],
  [[783, 501], [764, 635], 2], [[825, 507], [805, 636], 2],
  [[868, 515], [846, 641], 2], [[912, 525], [887, 642], 2],
  [[953, 533], [931, 646], 2], [[991, 537], [972, 647], 2],
  [[1031, 535], [1009, 648], 1],
  [[332, 188], [506, 212], 1], [[387, 169], [539, 191], 1],
  [[1054, 407], [1155, 441], 2], [[1035, 438], [1131, 471], 1],
];

export function paintTeAwaParking(ctx, project) {
  const at = point => project(...location(point));
  ctx.save();
  ctx.lineCap = 'butt';
  for (const [a, b] of [
    [[674, 469], [654, 557]], [[650, 567], [641, 609]],
    [[864, 519], [850, 566]], [[850, 579], [842, 634]],
  ]) {
    line(ctx, at(a), at(b), '#79796e', 2.5);
    line(ctx, at(a), at(b), '#c6b99f', 1.55);
  }
  const crossingStart = [675, 446], crossingEnd = [672, 468];
  for (let stripe = 0; stripe < 5; stripe++) {
    const [x, y] = mix(crossingStart, crossingEnd, stripe / 4);
    line(ctx, at([x - 4, y - 0.7]), at([x + 4, y + 0.7]), '#ede5ce', 0.52);
  }
  for (const [x, y] of [[731, 561], [770, 567], [815, 572], [870, 575], [909, 580], [952, 582], [990, 587]]) {
    line(ctx, at([x - 9, y - 2]), at([x + 9, y + 2]), '#b7ae91', 2.35);
    line(ctx, at([x - 8, y - 2]), at([x + 8, y + 2]), '#6e8058', 1.45);
  }
  paintParkingRows(ctx, at, parkingRows, 0.55, ([x, y]) =>
    x > 722 && x < 1000 && Math.abs(y - (561 + (x - 731) * 0.1)) < 8);
  ctx.restore();
}

export const teAwaVisitors = [
  [[711, 431], '#b05d47'], [[717, 435], '#426674'],
  [[768, 450], '#bf9862'], [[773, 453], '#496465'],
  [[664, 483], '#963c49'], [[661, 491], '#507e82'],
  [[649, 547], '#b27249'], [[647, 556], '#577786'],
].map(([point, colour]) => [...location(point), colour]);
