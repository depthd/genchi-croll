import { config } from '../config.js';
const streets = ['bins', 'barber', 'fork', 'barricade', 'market', 'alley'];
const roofs = ['skylight', 'gap25', 'gap34', 'bridge'];
const rooms = ['flat', 'kitchen', 'shop', 'stairwell'];
const drains = ['pipe', 'branch', 'water'];
export const templates = Array.from({ length: 16 }, (_, i) => ({
  id: streets[i % 6] + '_' + roofs[i % 4] + '_' + i,
  street: streets[i % 6],
  roof: roofs[i % 4],
  room: rooms[(i + Math.floor(i / 4)) % 4],
  drain: drains[i % 3],
  weight: 1 + (i % 3),
  threat: 1 + (i % 4),
  minProgress: i === 15 ? 0.35 : 0,
}));
export const layers = Object.keys(config.layers);
export function compatible(a, b) {
  return (
    a.layer === b.layer && a.kind === b.kind && Math.abs(a.y - b.y) <= config.joinTolerance && b.w >= a.w
  );
}
export const mix = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
function port(plan, i, layer) {
  const c = plan.cells[Math.min(i, plan.cells.length - 1)],
    p = plan.cells[Math.max(0, i - 1)],
    spec = config.layers[layer];
  const corner = c.dx !== p.dx || c.dz !== p.dz;
  const x = c.x + (i === plan.cells.length ? c.dx * config.segment : 0),
    z = c.z + (i === plan.cells.length ? c.dz * config.segment : 0);
  return {
    layer,
    kind: spec.kind,
    w: spec.width,
    x: x - spec.offset * (c.dz + (corner ? p.dz : 0)),
    z: z + spec.offset * (c.dx + (corner ? p.dx : 0)),
    y: spec.y,
  };
}
export function slab(a, b, w, layer, link = false) {
  const length = Math.hypot(b.x - a.x, b.z - a.z),
    dx = (b.x - a.x) / length,
    dz = (b.z - a.z) / length;
  return {
    a,
    b,
    w,
    layer,
    link,
    length,
    dx,
    dz,
    minX: Math.min(a.x, b.x) - (Math.abs(dz) * w) / 2,
    maxX: Math.max(a.x, b.x) + (Math.abs(dz) * w) / 2,
    minZ: Math.min(a.z, b.z) - (Math.abs(dx) * w) / 2,
    maxZ: Math.max(a.z, b.z) + (Math.abs(dx) * w) / 2,
  };
}
export function buildSegment(plan, i, t) {
  const entry = {},
    exit = {},
    slabs = [],
    jumps = [],
    links = [],
    paths = {};
  const c = plan.cells[i];
  const at = (u, y, d) => ({ x: c.x - c.dz * u + c.dx * d, y, z: c.z + c.dx * u + c.dz * d });
  for (const layer of layers) {
    const a = (entry[layer] = port(plan, i, layer)),
      b = (exit[layer] = port(plan, i + 1, layer));
    let points = [a, b];
    if (layer === 'I')
      points = [
        a,
        at(8.8, 0.04, 8),
        at(t.room === 'kitchen' ? 10.2 : 7.5, 0.04, 17),
        at(8.8, 0.04, 25),
        b,
      ];
    paths[layer] = points;
    if (layer === 'R') {
      const left = at(-9.5, 9.6, 14.6),
        right = at(-9.5, 9.6, 17.4);
      const jump = t.roof.startsWith('gap') && i % 4 === 2;
      slabs.push(slab(a, left, a.w, layer), slab(right, b, a.w, layer));
      if (jump) jumps.push({ a: left, b: right, layer });
      else {
        const bridge = slab(left, right, 1.6, layer);
        bridge.bridge = true;
        slabs.push(bridge);
      }
      paths.R = [a, left, right, b];
    } else
      for (let n = 1; n < points.length; n++) slabs.push(slab(points[n - 1], points[n], a.w, layer));
  }
  // The street is continuous ground. The other paths belong to buildings and tunnels.
  slabs[0].w = 36;
  Object.assign(slabs[0], slab(entry.G, exit.G, 36, 'G'));
  function connect(from, to, points, kind = 'stair') {
    const pieces = [];
    for (let n = 1; n < points.length; n++) {
      const p = slab(points[n - 1], points[n], 1.6, to, true);
      p.from = from;
      p.to = to;
      p.kind = kind;
      pieces.push(p);
      slabs.push(p);
    }
    links.push({ from, to, kind, points, pieces, a: points[0], b: points.at(-1) });
  }
  // Switchback fire escape fixed to the front of a real roof-bearing building.
  if (i % 2 === 0 || plan.relays.includes(i) || i === plan.cells.length - 1) {
    connect('G', 'R', [
      at(-3.5, 0, 4),
      at(-3.5, 3.2, 11),
      at(-5.3, 3.2, 11),
      at(-5.3, 6.4, 4),
      at(-7.1, 6.4, 4),
      at(-7.1, 9.6, 11),
      at(-9.5, 9.6, 11),
    ]);
  }
  for (const p of slabs.filter((p) => p.layer === 'R' && !p.link)) {
    if (links.some((l) => l.to === 'R'))
      p.holes = [{ a: at(-7.1, 0, 3.2), b: at(-7.1, 0, 11.9), radius: 1.03 }];
  }
  connect('G', 'I', [at(2.6, 0.04, 6), at(8.8, 0.04, 6)], 'door');
  connect('G', 'I', [at(8.8, 0.04, 26), at(2.6, 0.04, 26)], 'door');
  const hatch = at(3, 0, 19);
  hatch.x = Math.floor(hatch.x / 2) * 2 + 1;
  hatch.z = Math.floor(hatch.z / 2) * 2 + 1;
  const devices =
    i % 3 === 1 || i === plan.cells.length - 1
      ? [{ kind: 'hatch', layer: 'U', x: hatch.x, z: hatch.z, low: -4.5, high: 0 }]
      : [];
  if (devices.length) {
    connect('U', 'U', [{ ...hatch, y: -4.5 }, at(0, -4.5, 19)], 'tunnel');
  }
  const g = at(2.1, 0, 22);
  const cover = { x: g.x, y: 0, z: g.z, w: 1.15, h: 1.15, d: 1.45 };
  const enemy = {
    x: g.x + c.dx * 1.9,
    y: 0,
    z: g.z + c.dz * 1.9,
    peekX: c.dz * 1.7,
    peekZ: -c.dx * 1.7,
  };
  return {
    i,
    devices,
    id: t.id,
    template: t,
    entry,
    exit,
    slabs,
    links,
    paths,
    jumps,
    cover,
    enemy,
    threat: t.threat,
  };
}
export function steerBot(body, segment, layer, dt) {
  const points = segment.paths[layer];
  if (body.botSegment !== segment.i) {
    body.botSegment = segment.i;
    body.waypoint = 1;
  }
  let target = points[body.waypoint];
  if (Math.hypot(target.x - body.x, target.z - body.z) < 0.04 && body.waypoint < points.length - 1)
    target = points[++body.waypoint];
  const dx = target.x - body.x,
    dz = target.z - body.z,
    d = Math.hypot(dx, dz),
    stride = Math.min(d, config.sprint * dt);
  const lip = segment.jumps.find((j) => j.layer === layer)?.a;
  return {
    dx: d ? (dx / d) * stride : 0,
    dz: d ? (dz / d) * stride : 0,
    jump: !!lip && Math.hypot(body.x - lip.x, body.z - lip.z) < 0.24,
    arrived: d < 0.02 && body.waypoint === points.length - 1,
  };
}
