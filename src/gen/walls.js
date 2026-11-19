import { mix } from './segments.js';
export function placeWalls(plan, segments) {
  for (const s of segments) {
    const c = plan.cells[s.i],
      v = s.i % 3;
    s.walls = [];
    s.architecture = [];
    s.doors = [];
    const at = (u, y, t) => ({ x: c.x - c.dz * u + c.dx * t, y, z: c.z + c.dx * u + c.dz * t });
    function box(id, u, y, t, w, h, d, kind = 'cement', collision = true) {
      const p = at(u, y, t),
        b = { id, ...p, w, h, d, dx: c.dx, dz: c.dz, kind: kind + v };
      s.architecture.push(b);
      if (collision) s.walls.push(b);
      return b;
    }
    for (const side of [-1, 1])
      box('back-block', side * 18, 7.8 + (s.i % 3), 16, 7, 15.6 + (s.i % 3) * 2, 32, 'cement');
    const a = s.entry.R,
      b = s.exit.R,
      lo = (a.x - c.x) * c.dx + (a.z - c.z) * c.dz,
      hi = (b.x - c.x) * c.dx + (b.z - c.z) * c.dz;
    // Roof loads continue into walls and foundations. A roof gap is an actual gap between houses.
    const intervals = [
      [lo, 14.6],
      [17.4, hi],
    ];
    for (const [n, [start, end]] of intervals.entries()) {
      if (end - start < 0.1) continue;
      const d = end - start,
        t = (start + end) / 2;
      const stair = s.links.some((l) => l.to === 'R');
      if (stair) {
        box('left-rear' + n, -10.7, 4.7, t, 5.6, 9.4, d, 'brick');
        for (const [x, y] of [
          [start, Math.min(end, 2.8)],
          [Math.max(start, 12.2), end],
        ])
          if (y > x) box('left-front' + n, -6.7, 4.7, (x + y) / 2, 2.4, 9.4, y - x, 'brick');
      } else box('left-house' + n, -9.5, 4.7, t, 8, 9.4, d, 'brick');
      // Thin floor cap meets the walkable roof without a second coplanar face.
      box('roof-cap' + n, -9.5, 9.48, t, 8, 0.24, d, 'cement', false);
      box('outer-parapet' + n, -13.35, 10.02, t, 0.3, 0.84, d, 'cement');
    }
    // Roof-access rooms and plant equipment break up the roof into actual household terraces.
    box('roof-access-room', -7.1, 10.9, 26, 2.65, 2.6, 4.1, 'brick');
    box('roof-tank', -12.05, 10.5, 7, 2, 1.8, 2.6, 'steel');
    // The service route is inside the right-hand housing block, with two street doors.
    const start = (s.entry.I.x - c.x) * c.dx + (s.entry.I.z - c.z) * c.dz,
      end = (s.exit.I.x - c.x) * c.dx + (s.exit.I.z - c.z) * c.dz;
    box('rear-wall', 14.1, 5.1, (start + end) / 2, 0.5, 10.2, end - start, 'brick');
    for (const [j, [lo, hi]] of [
      [start, 4.9],
      [7.1, 24.9],
      [27.1, end],
    ].entries()) {
      if (hi > lo) box('shopfront' + j, 4.65, 1.48, (lo + hi) / 2, 0.4, 2.96, hi - lo, 'tile');
    }
    box('shopfront-lintel', 4.65, 3.05, (start + end) / 2, 0.4, 0.18, end - start, 'cement');
    // Upper floors enclose the rooms and provide a convincing building volume.
    box('upper-storeys', 9.4, 7.0, (start + end) / 2, 9.7, 7.6, end - start, 'cement');
    box('interior-ceiling', 9.4, 3.1, (start + end) / 2, 9.7, 0.14, end - start, 'cement');
    // Cross walls turn the interior into rooms instead of an exposed parallel track.
    for (const t of [11, 22]) {
      const points = s.paths.I;
      const after = points.findIndex((p) => (p.x - c.x) * c.dx + (p.z - c.z) * c.dz >= t);
      const a = points[Math.max(0, after - 1)],
        b = points[Math.max(1, after)];
      const ta = (a.x - c.x) * c.dx + (a.z - c.z) * c.dz,
        tb = (b.x - c.x) * c.dx + (b.z - c.z) * c.dz;
      const p = mix(a, b, (t - ta) / (tb - ta));
      const u = (p.x - c.x) * -c.dz + (p.z - c.z) * c.dx,
        opening = 1.9;
      const left = 4.85,
        right = 13.85;
      for (const [lo, hi] of [
        [left, u - opening / 2],
        [u + opening / 2, right],
      ])
        box('partition', (lo + hi) / 2, 1.45, t, hi - lo, 2.82, 0.22, 'tile');
      box('door-header', u, 2.64, t, opening, 0.42, 0.22, 'tile');
    }
    for (const t of [6, 26])
      s.doors.push({ ...at(4.65, 1.34, t), w: 2.0, h: 2.6, d: 0.12, dx: c.dx, dz: c.dz });
    // Sewer walls and ceiling remain underground and meet the street foundations.
    for (const side of [-1, 1]) box('sewer-wall', side * 2.25, -2.65, 16, 0.5, 3.7, 32, 'steel');
    // Ceiling is the underside of the street; openings are cut into the shared ground tiles.
    for (const d of s.devices) {
      const u = (d.x - c.x) * -c.dz + (d.z - c.z) * c.dx,
        t = (d.x - c.x) * c.dx + (d.z - c.z) * c.dz;
      for (const side of [-1, 1]) box('shaft-wall', u + side * 1.18, -2.25, t, 0.22, 4.5, 2, 'cement');
    }
  }
  // Carve the actual walking headroom through corner buildings, preserving foundations and lintels.
  for (const s of segments) {
    const neighbors = segments.slice(Math.max(0, s.i - 1), s.i + 2);
    const clearance = neighbors.flatMap((n) =>
      n.slabs
        .concat(n.jumps.map((j) => ({ ...j, layer: 'R' })))
        .filter(
          (p) => p.layer === 'G' || p.link || p.layer === 'R' || p.layer === 'I' || p.layer === 'U',
        )
        .map((p) => {
          const street = p.layer === 'G' && !p.link;
          const r = street ? 3.7 : p.link ? 1.02 : 0.85;
          return {
            minX: Math.min(p.a.x, p.b.x) - r,
            maxX: Math.max(p.a.x, p.b.x) + r,
            minZ: Math.min(p.a.z, p.b.z) - r,
            maxZ: Math.max(p.a.z, p.b.z) + r,
            minY: street ? -0.02 : Math.min(p.a.y, p.b.y) + 0.08,
            maxY: street ? 60 : Math.max(p.a.y, p.b.y) + (p.layer === 'R' ? 3.3 : 2.05),
          };
        }),
    );
    let parts = s.architecture;
    for (const cut of clearance) parts = parts.flatMap((b) => subtract(b, cut));
    s.architecture = parts;
    s.walls = parts.filter((b) => !b.id.startsWith('roof-cap'));
  }
  // Mitered roof footprints meet at turns. Assign the overlapping cap volume once.
  const roofs = [];
  for (const s of segments) {
    const caps = s.architecture.filter((b) => b.id.startsWith('roof-cap'));
    const unique = [];
    for (const cap of caps) {
      let pieces = [cap];
      for (const prev of roofs) {
        const w = prev.dx ? prev.d : prev.w,
          d = prev.dx ? prev.w : prev.d;
        pieces = pieces.flatMap((b) =>
          subtract(b, {
            minX: prev.x - w / 2,
            maxX: prev.x + w / 2,
            minZ: prev.z - d / 2,
            maxZ: prev.z + d / 2,
            minY: prev.y - prev.h / 2 - 0.001,
            maxY: prev.y + prev.h / 2 + 0.001,
          }),
        );
      }
      unique.push(...pieces);
      roofs.push(...pieces);
    }
    s.architecture = s.architecture.filter((b) => !b.id.startsWith('roof-cap')).concat(unique);
  }
  // Each two-metre ground tile belongs to exactly one segment, even at corners.
  const tiles = new Map();
  for (const s of segments) {
    const c = plan.cells[s.i];
    for (let t = -16; t < 48; t += 2)
      for (let u = -18; u < 18; u += 2) {
        const x = Math.floor((c.x + c.dx * t - c.dz * u) / 2) * 2 + 1,
          z = Math.floor((c.z + c.dz * t + c.dx * u) / 2) * 2 + 1;
        const along = Math.max(0, Math.min(32, (x - c.x) * c.dx + (z - c.z) * c.dz));
        const dist = Math.hypot(x - c.x - c.dx * along, z - c.z - c.dz * along);
        if (dist > 18) continue;
        const key = x + ',' + z,
          old = tiles.get(key);
        if (!old || dist < old.dist) tiles.set(key, { x, z, dist, owner: s.i });
      }
  }
  const rooms = new Map();
  for (const s of segments) {
    s.roomFloor = [];
    const c = plan.cells[s.i];
    const lo = (s.entry.I.x - c.x) * c.dx + (s.entry.I.z - c.z) * c.dz,
      hi = (s.exit.I.x - c.x) * c.dx + (s.exit.I.z - c.z) * c.dz;
    for (let t = Math.floor(lo); t < hi; t++)
      for (let u = 5; u < 14; u++) {
        const x = Math.floor(c.x + c.dx * (t + 0.5) - c.dz * (u + 0.5)) + 0.5,
          z = Math.floor(c.z + c.dz * (t + 0.5) + c.dx * (u + 0.5)) + 0.5;
        const key = x + ',' + z;
        if (!rooms.has(key)) rooms.set(key, { x, z, owner: s.i });
      }
  }
  for (const tile of rooms.values()) segments[tile.owner].roomFloor.push(tile);
  const holes = segments.flatMap((s) => s.devices);
  for (const s of segments) s.ground = [];
  for (const tile of tiles.values())
    if (!holes.some((h) => Math.abs(tile.x - h.x) < 0.1 && Math.abs(tile.z - h.z) < 0.1))
      segments[tile.owner].ground.push(tile);
  return segments;
}

function subtract(b, c) {
  const w = b.dx ? b.d : b.w,
    d = b.dx ? b.w : b.d;
  const lo = [b.x - w / 2, b.y - b.h / 2, b.z - d / 2],
    hi = [b.x + w / 2, b.y + b.h / 2, b.z + d / 2];
  const cl = [c.minX, c.minY, c.minZ],
    ch = [c.maxX, c.maxY, c.maxZ];
  if (lo.some((v, i) => v >= ch[i] || hi[i] <= cl[i])) return [b];
  const out = [];
  function emit(a, z) {
    if (z.some((v, i) => v - a[i] < 0.025)) return;
    out.push({
      ...b,
      x: (a[0] + z[0]) / 2,
      y: (a[1] + z[1]) / 2,
      z: (a[2] + z[2]) / 2,
      w: b.dx ? z[2] - a[2] : z[0] - a[0],
      h: z[1] - a[1],
      d: b.dx ? z[0] - a[0] : z[2] - a[2],
    });
  }
  for (let axis = 0; axis < 3; axis++) {
    if (lo[axis] < cl[axis]) {
      const end = [...hi];
      end[axis] = cl[axis];
      emit(lo, end);
      lo[axis] = cl[axis];
    }
    if (hi[axis] > ch[axis]) {
      const start = [...lo];
      start[axis] = ch[axis];
      emit(start, hi);
      hi[axis] = ch[axis];
    }
  }
  return out;
}
