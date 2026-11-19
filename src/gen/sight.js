import { boxCoordinates } from './boxes.js';
import { sample } from './physics.js';
function hitsBox(a, b, x, y, z, w, h, d) {
  let lo = 0,
    hi = 1;
  for (const [axis, center, half] of [
    ['x', x, w / 2],
    ['y', y, h / 2],
    ['z', z, d / 2],
  ]) {
    const velocity = b[axis] - a[axis],
      offset = a[axis] - center;
    if (Math.abs(velocity) < 1e-9) {
      if (Math.abs(offset) > half) return false;
      continue;
    }
    const t1 = (-half - offset) / velocity,
      t2 = (half - offset) / velocity;
    lo = Math.max(lo, Math.min(t1, t2));
    hi = Math.min(hi, Math.max(t1, t2));
    if (lo > hi) return false;
  }
  return true;
}
export function visible(a, b, near) {
  for (const s of near) {
    for (const w of s.walls) {
      const l = boxCoordinates(w, a.x, a.z),
        r = boxCoordinates(w, b.x, b.z);
      if (hitsBox({ ...l, y: a.y }, { ...r, y: b.y }, 0, w.y, 0, w.w, w.h, w.d)) return false;
    }
    const k = s.cover;
    if (hitsBox(a, b, k.x, k.y + k.h / 2, k.z, k.w, k.h, k.d)) return false;
    for (const p of s.slabs) {
      const offset = (q) =>
        q.y - p.a.y - (((q.x - p.a.x) * p.dx + (q.z - p.a.z) * p.dz) * (p.b.y - p.a.y)) / p.length;
      const l = offset(a),
        r = offset(b);
      if (l * r > 0 || Math.abs(l - r) < 1e-9) continue;
      const t = l / (l - r);
      if (sample(p, a.x + t * (b.x - a.x), a.z + t * (b.z - a.z)) !== null) return false;
    }
  }
  return true;
}
export function assignSight(plan, segments) {
  for (const s of segments) {
    const c = plan.cells[s.i],
      near = segments.slice(Math.max(0, s.i - 1), s.i + 2),
      e = s.enemy;
    const target = { x: e.x + e.peekX, y: 1.65, z: e.z + e.peekZ };
    for (const sign of [-1, 1])
      for (const side of [0, -1, 1, -1.8, 1.8]) {
        if (s.sight) break;
        const eye = {
          x: c.x + c.dx * (23.9 + 13 * sign) - c.dz * side,
          y: 1.6,
          z: c.z + c.dz * (23.9 + 13 * sign) + c.dx * side,
        };
        if (
          !near.some((n) =>
            n.slabs.some((p) => p.layer === 'G' && !p.link && sample(p, eye.x, eye.z) !== null),
          )
        )
          continue;
        if (visible(eye, target, near)) s.sight = eye;
      }
    if (!s.sight) throw Error('Нет видимости для засады в сегменте ' + s.i + ' сида ' + plan.seed);
  }
  return segments;
}
