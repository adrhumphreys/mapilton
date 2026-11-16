export function paintPerson(ctx, x, y, colour, stride = 0, facing = 1, gesture = 0, umbrella = null) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = '#34494485';
  ctx.fillRect(x, y, 3, 1);
  ctx.fillStyle = '#343f4d';
  ctx.fillRect(x + stride, y - 1, 1, 2);
  ctx.fillRect(x - stride, y - 1, 1, 1);
  ctx.fillStyle = colour;
  ctx.fillRect(x - 1, y - 3, 2, 2);
  ctx.fillStyle = '#e5b184';
  ctx.fillRect(facing > 0 ? x : x - 1, y - 4, 1, 1);
  if (gesture) ctx.fillRect(gesture > 0 ? x + 1 : x - 2, y - 3, 1, 1);
  if (umbrella) {
    ctx.fillStyle = '#3a3f44';
    ctx.fillRect(x, y - 5, 1, 1);
    ctx.fillStyle = umbrella;
    ctx.fillRect(x - 2, y - 6, 5, 1);
    ctx.fillRect(x - 1, y - 7, 3, 1);
  }
}

export function paintDog(ctx, x, y, colour, trot, facing) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = '#34494470';
  ctx.fillRect(x - 1, y, 3, 1);
  ctx.fillStyle = colour;
  ctx.fillRect(x - 1, y - 1, 3, 1);
  ctx.fillRect(facing > 0 ? x + 1 : x - 1, y - 2, 1, 1);
  ctx.fillStyle = '#2f3330';
  ctx.fillRect(trot ? x - 1 : x, y, 1, 1);
}
