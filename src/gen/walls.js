import { mix } from './segments.js';
// Reserve the full headroom and width of every walkable strip, including turn ports.
function clear(b, slabs) {
  return !slabs.some(
    (s) =>
      b.x + b.w / 2 > s.minX - 0.04 &&
      b.x - b.w / 2 < s.maxX + 0.04 &&
      b.z + b.d / 2 > s.minZ - 0.04 &&
      b.z - b.d / 2 < s.maxZ + 0.04 &&
      b.y + b.h / 2 > Math.min(s.a.y, s.b.y) + 0.02 &&
      b.y - b.h / 2 < Math.max(s.a.y, s.b.y) + 1.8,
  );
}
export function placeWalls(plan, segments) {
  for (const s of segments) {
    const c = plan.cells[s.i],
      near = segments.slice(Math.max(0, s.i - 1), s.i + 2).flatMap((n) => n.slabs);
    const walls = (s.walls = []);
    function add(id, x, y, z, w, h, d, kind) {
      const b = { id, x, y, z, w: c.dx ? d : w, h, d: c.dx ? w : d, kind };
      const shaft = s.devices.some(
        (d) =>
          Math.abs(d.x - b.x) < b.w / 2 + 0.8 &&
          Math.abs(d.z - b.z) < b.d / 2 + 0.8 &&
          b.y + b.h / 2 > d.low &&
          b.y - b.h / 2 < d.high + 1.7,
      );
      if (!shaft && clear(b, near)) walls.push(b);
    }
    const reserved = near.filter((p) => !p.pavement);
    for (const t of [6 + (s.i % 3), 26, 15]) {
      const u = -3.65;
      const b = {
        id: 'shop',
        x: c.x - c.dz * u + c.dx * t,
        y: 1.6,
        z: c.z + c.dx * u + c.dz * t,
        w: c.dx ? 5 : 0.5,
        h: 3.2,
        d: c.dx ? 0.5 : 5,
        kind: 'tile',
      };
      if (clear(b, reserved)) {
        s.shop = t;
        walls.push(b);
        break;
      }
    }
    for (const sign of [-1, 1])
      for (let bay = 0; bay < 4; bay++) {
        const edge = sign < 0 ? -11 : 14,
          t = 5 + bay * 7,
          u = edge + sign * 2.2;
        const height = (3 + ((s.i * 3 + bay + (sign + 1)) % 4)) * 3.2;
        add(
          'facade' + sign + '_' + bay,
          c.x - c.dz * u + c.dx * t,
          height / 2 - 1,
          c.z + c.dx * u + c.dz * t,
          4.3,
          height + 2,
          6.85,
          'brick',
        );
      }
    for (const layer of ['I', 'U']) {
      const a = s.entry[layer],
        b = s.exit[layer];
      for (const t of [0.12, 0.36, 0.6, 0.84]) {
        const p = mix(a, b, t),
          ceiling = layer === 'I' ? 3.15 : 3.05;
        const length = Math.min(7.4, Math.hypot(b.x - a.x, b.z - a.z) * 0.21);
        for (const sign of [-1, 1]) {
          const u = sign * (a.w / 2 + 0.26);
          add(
            layer + sign + '_' + t,
            p.x - c.dz * u,
            p.y + ceiling / 2,
            p.z + c.dx * u,
            0.36,
            ceiling,
            length,
            layer === 'I' ? 'tile' : 'steel',
          );
        }
        add(layer + 'roof' + t, p.x, p.y + ceiling, p.z, a.w + 0.64, 0.15, length, 'steel');
      }
    }
  }
  return segments;
}
