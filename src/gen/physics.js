import { useDevice } from './devices.js';
import { config } from '../config.js';
export function sample(s, x, z, padding = 0) {
  if (x < s.minX - padding || x > s.maxX + padding || z < s.minZ - padding || z > s.maxZ + padding)
    return null;
  const rx = x - s.a.x,
    rz = z - s.a.z,
    t = rx * s.dx + rz * s.dz,
    side = rz * s.dx - rx * s.dz;
  if (t < -padding - 1e-7 || t > s.length + padding + 1e-7 || Math.abs(side) > s.w / 2 + padding)
    return null;
  return s.a.y + (s.b.y - s.a.y) * Math.max(0, Math.min(1, t / s.length));
}
export function ground(segments, x, z, ceiling) {
  let floor = -Infinity;
  for (const seg of segments) {
    for (const s of seg.slabs) {
      const h = sample(s, x, z, 0.015);
      if (h !== null && h <= ceiling && h > floor) floor = h;
    }
    const b = seg.cover;
    if (Math.abs(x - b.x) < b.w / 2 + 0.28 && Math.abs(z - b.z) < b.d / 2 + 0.28 && b.y + b.h <= ceiling)
      floor = Math.max(floor, b.y + b.h);
  }
  return floor;
}
export function advance(body, segments, dx, dz, dt, jump = false) {
  if (useDevice(body, segments, dx, dz, dt)) return;
  if (jump && body.grace > 0) {
    body.vy = Math.sqrt(2 * config.gravity * config.jump);
    body.grace = 0;
  }
  for (const axis of ['x', 'z']) {
    const x = body.x + (axis === 'x' ? dx : 0),
      z = body.z + (axis === 'z' ? dz : 0);
    const inWall = segments.some((seg) =>
      seg.walls.some(
        (b) =>
          Math.abs(x - b.x) < b.w / 2 + 0.28 &&
          Math.abs(z - b.z) < b.d / 2 + 0.28 &&
          body.y + 1.7 > b.y - b.h / 2 &&
          body.y + config.step < b.y + b.h / 2,
      ),
    );
    if (inWall) continue;
    if (
      segments.some(
        ({ cover: b }) =>
          Math.abs(x - b.x) < b.w / 2 + 0.28 &&
          Math.abs(z - b.z) < b.d / 2 + 0.28 &&
          body.y + 1.7 > b.y &&
          body.y + config.vault < b.y + b.h,
      )
    )
      continue;
    body[axis] = axis === 'x' ? x : z;
  }
  const floor = ground(segments, body.x, body.z, body.y + (body.grace > 0 ? config.vault : config.step));
  body.vy -= config.gravity * dt;
  body.y += body.vy * dt;
  if (body.y <= floor && body.vy <= 0) {
    body.y = floor;
    body.vy = 0;
    body.grace = config.jumpBuffer;
  } else body.grace = Math.max(0, body.grace - dt);
}
