import { hash } from './paths.js?life=3';

const fade = 2.5;

function paintSitter(ctx, x, y, colour, facing, gesture, legs) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = '#343f4d';
  ctx.fillRect(x - 1, y - 2, 2, 1);
  ctx.fillRect(legs > 0 ? x + 1 : x - 2, y - 1, 1, 1);
  ctx.fillStyle = colour;
  ctx.fillRect(x - 1, y - 4, 2, 2);
  ctx.fillStyle = '#e5b184';
  ctx.fillRect(facing > 0 ? x : x - 1, y - 5, 1, 1);
  if (gesture) ctx.fillRect(gesture > 0 ? x + 1 : x - 2, y - 4, 1, 1);
}

export function createLeisure(details, project, elevation, clothing) {
  const seats = [];
  details.forEach(([kind, east, south], id) => {
    if (kind !== 'bench' && kind !== 'picnic') return;
    const [x, y] = elevation.point(project(east, south));
    seats.push({ kind, x: Math.round(x), y: Math.round(y), seed: hash(id, 6007), id });
  });
  return { seats, clothing };
}

function occupancy(seat, clock, appetite) {
  const length = seat.kind === 'picnic' ? 900 + seat.seed * 900 : 240 + seat.seed * 420;
  const cycle = clock / length + seat.seed * 7;
  const round = Math.floor(cycle);
  const roll = hash(seat.id, round);
  if (roll >= appetite * (seat.kind === 'picnic' ? 0.75 : 0.85)) return null;
  const elapsed = (cycle - round) * length, remaining = length - elapsed;
  return { round, alpha: Math.min(1, elapsed / fade, remaining / fade), extra: hash(seat.id, round + 5000) };
}

export function paintLeisure(ctx, leisure, sky, clock, bounds) {
  const { seats, clothing } = leisure;
  const dressed = (seat, round, slot) => clothing[Math.floor(hash(seat.id * 8 + slot, round + 77) * clothing.length)];
  for (const seat of seats) {
    const { x, y, kind, id } = seat;
    if (x < bounds.left - 6 || x > bounds.right + 6 || y < bounds.top - 6 || y > bounds.bottom + 6) continue;
    const visit = occupancy(seat, clock, sky.seated);
    if (!visit) continue;
    ctx.globalAlpha = visit.alpha;
    const beat = Math.floor(clock / 3 + seat.seed * 13);
    const glance = slot => hash(id * 8 + slot, beat) < 0.5 ? 1 : -1;
    if (kind === 'bench') {
      const pair = visit.extra < 0.42;
      if (pair) {
        const talking = hash(id, Math.floor(clock / 0.7)) < 0.25;
        paintSitter(ctx, x - 0.5, y, dressed(seat, visit.round, 0), 1, talking ? 1 : 0, 1);
        paintSitter(ctx, x + 2, y, dressed(seat, visit.round, 1), hash(id, beat) < 0.7 ? -1 : 1, 0, 1);
      } else {
        paintSitter(ctx, x + (visit.extra < 0.7 ? 0 : 1.5), y, dressed(seat, visit.round, 0), glance(0), 0, 1);
      }
    } else {
      const places = [[-2.5, -0.6, 1], [3.6, -1.9, -1], [-0.4, -3.6, 1], [2.2, -4.2, -1]];
      const diners = 2 + Math.floor(visit.extra * 3);
      places.slice(0, diners).forEach(([dx, dy, facing], slot) => {
        const gesture = hash(id * 8 + slot, Math.floor(clock / 0.8)) < 0.18 ? facing : 0;
        paintSitter(ctx, x + dx, y + dy, dressed(seat, visit.round, slot), facing, gesture, facing);
      });
    }
  }
  ctx.globalAlpha = 1;
}
