import { hash } from './paths.js?life=3';

const innesCommon = { lat: -37.7956, lon: 175.2702 };
const flight = 1500;
const inflate = 70;
const climb = 220;
const descend = 240;
const parked = 90;
const envelope = [2, 3, 4, 5, 5, 5, 5, 5, 4, 4, 3, 2, 1];
const designs = [
  ['#d8453a', '#f2c14e'],
  ['#2f6fb0', '#f3ecd8', '#2f6fb0', '#e45f3c'],
  ['#3f9b6a', '#f29b38'],
  ['#8c4fa3', '#f4d35e', '#41b3a3'],
  ['#f08a8a', '#ffffff'],
  ['#1f4e79', '#f2c14e', '#d8453a'],
  ['#f4d35e', '#2a2a2a'],
];

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channel = shift => Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) * amount)));
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function paintSprite(colours) {
  const canvas = document.createElement('canvas');
  canvas.width = 13;
  canvas.height = 19;
  const ctx = canvas.getContext('2d');
  envelope.forEach((half, row) => {
    for (let col = -half; col <= half; col++) {
      const colour = colours[(col + 5) % colours.length];
      const lit = col < -half + 2 && row < 9 ? 1.12 : col >= half - 1 ? 0.72 : 1;
      ctx.fillStyle = shade(colour, lit * (row > 9 ? 0.88 : 1));
      ctx.fillRect(6 + col, row, 1, 1);
    }
  });
  ctx.fillStyle = '#ffffffa0';
  ctx.fillRect(4, 2, 1, 2);
  ctx.fillStyle = '#5c5048';
  ctx.fillRect(5, 13, 1, 2);
  ctx.fillRect(7, 13, 1, 2);
  ctx.fillStyle = '#8a6a44';
  ctx.fillRect(5, 15, 3, 2);
  ctx.fillStyle = '#6b5034';
  ctx.fillRect(5, 16, 3, 1);
  return canvas;
}

export function createBalloons(project, elevation) {
  const x = (innesCommon.lon - 175.286) * 87900;
  const y = (-37.792 - innesCommon.lat) * 111000;
  const [lx, ly] = elevation.point(project(x, y));
  return designs.map((colours, index) => ({
    sprite: paintSprite(colours),
    launch: [lx + (hash(index, 41) - 0.5) * 60, ly + (hash(index, 43) - 0.5) * 30],
    offset: -(index * 34 + hash(index, 47) * 26),
    cruise: 55 + hash(index, 49) * 70,
    lift: 0.85 + hash(index, 53) * 0.3,
    seed: index,
  }));
}

function flightPath(balloon, clock, drift) {
  const cycle = flight + parked;
  const age = ((clock + balloon.offset) % cycle + cycle) % cycle;
  const airborne = Math.max(0, Math.min(age, flight) - inflate);
  const altitude = age < inflate ? 0
    : age < inflate + climb ? balloon.cruise * Math.sin((age - inflate) / climb * Math.PI / 2)
      : age < flight - descend ? balloon.cruise + Math.sin(age / 47 + balloon.seed) * 8
        : age < flight ? balloon.cruise * (flight - age) / descend : 0;
  const speed = airborne * balloon.lift;
  return {
    age,
    altitude: Math.max(0, altitude),
    x: balloon.launch[0] + drift[0] * speed,
    y: balloon.launch[1] + drift[1] * speed,
    standing: age < inflate ? age / inflate : age > flight ? 1 - (age - flight) / parked : 1,
  };
}

export function paintBalloons(ctx, balloons, sky, clock, bounds) {
  if (!sky.balloons) return;
  for (const balloon of balloons) {
    const { x, y, altitude, standing, age } = flightPath(balloon, clock, sky.drift);
    if (standing <= 0) continue;
    if (x < bounds.left - 40 || x > bounds.right + 40 || y < bounds.top - 160 || y > bounds.bottom + 60) continue;
    if (altitude > 4 && sky.shadows > 0.05) {
      ctx.fillStyle = `rgba(36, 52, 44, ${Math.min(0.3, sky.shadows * 0.32) * (1 - altitude / 260)})`;
      ctx.beginPath();
      ctx.ellipse(x + altitude * 0.85, y + altitude * 0.39, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const height = Math.max(4, Math.round(19 * Math.min(1, standing * 1.4)));
    const left = Math.round(x - 6), top = Math.round(y - altitude - height);
    ctx.globalAlpha = Math.min(1, standing * 2);
    ctx.drawImage(balloon.sprite, 0, 19 - height, 13, height, left, top, 13, height);
    ctx.globalAlpha = 1;
    const burning = altitude > 0 && hash(balloon.seed, Math.floor(age * 2.5)) < (age < inflate + climb ? 0.45 : 0.12);
    if (burning) {
      ctx.fillStyle = '#ffd36b';
      ctx.fillRect(left + 6, top + 12, 1, 1);
      ctx.fillStyle = '#ff8a3d';
      ctx.fillRect(left + 6, top + 13, 1, 1);
    }
  }
}
