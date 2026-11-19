import { describeSkin } from '../src/gen/skin.js';
import { visible } from '../src/gen/sight.js';
import { createHash } from 'node:crypto';
import { route } from '../src/gen/route.js';
import { sequence } from '../src/gen/sequencer.js';
import { layers, compatible } from '../src/gen/segments.js';
import { canTraverse, config } from '../src/config.js';
const seeds = Number(process.argv[process.argv.indexOf('--seeds') + 1]) || 1000;
const totals = Array(9).fill(0),
  costs = Object.fromEntries(layers.map((k) => [k, []]));
const digest = (s) => createHash('sha256').update(JSON.stringify(s)).digest('hex');
function inspectShell(plan, segments) {
  const hash = createHash('sha256');
  let maxTriangles = 0;
  for (const segment of segments) {
    const commands = [];
    let triangles = 0;
    describeSkin(plan, segment, {
      face(...args) {
        triangles += 2;
        commands.push(args);
      },
      box(...args) {
        triangles += 12;
        commands.push(args);
      },
    });
    hash.update(JSON.stringify(commands));
    maxTriangles = Math.max(maxTriangles, triangles);
  }
  return { hash: hash.digest('hex'), maxTriangles };
}
for (let seed = 0; seed < seeds; seed++) {
  const plan = route(seed),
    segments = sequence(plan),
    ok = Array(9).fill(true);
  let next = new Set(layers),
    exitGround = new Set(['G']);
  for (const s of segments.toReversed()) {
    const live = new Set(),
      escape = new Set();
    for (const k of layers) {
      const parts = s.slabs.filter((p) => !p.link && p.layer === k);
      const pass =
        parts.length &&
        parts.every((p) => canTraverse(p.a, p.b, 'ramp')) &&
        s.jumps.filter((j) => j.layer === k).every((j) => canTraverse(j.a, j.b));
      const end = s.exit[k],
        start = segments[s.i + 1]?.entry[k];
      const join =
        !start || (compatible(end, start) && Math.hypot(end.x - start.x, end.z - start.z) < 0.001);
      if (pass && join && next.has(k)) live.add(k);
      if (pass && join && (k === 'G' || exitGround.has(k))) escape.add(k);
    }
    for (let i = 0; i < layers.length; i++)
      for (const l of s.links) {
        if (!canTraverse(l.a, l.b, 'ramp')) {
          ok[5] = false;
          continue;
        }
        if (escape.has(l.from) || escape.has(l.to)) {
          escape.add(l.from);
          escape.add(l.to);
        }
      }
    ok[0] &&= live.size === 4;
    ok[1] &&= escape.size === 4;
    ok[2] &&= live.size >= 2;
    next = live;
    exitGround = escape;
  }
  for (const s of segments) {
    const c = plan.cells[s.i];
    const bounds = { x: c.x + c.dx * 16, z: c.z + c.dz * 16 };
    for (const other of plan.cells.slice(s.i + 2)) {
      if (
        Math.abs(bounds.x - other.x - other.dx * 16) < 32 &&
        Math.abs(bounds.z - other.z - other.dz * 16) < 32
      )
        ok[4] = false;
    }
    const shot = { y: 1.65, x: s.enemy.x + s.enemy.peekX, z: s.enemy.z + s.enemy.peekZ };
    for (const other of segments.slice(s.i + 2)) {
      if (Math.abs(c.x - plan.cells[other.i].x) > 96 || Math.abs(c.z - plan.cells[other.i].z) > 96)
        continue;
      for (const a of s.slabs)
        for (const b of other.slabs) {
          if (
            a.maxX > b.minX + 0.001 &&
            a.minX < b.maxX - 0.001 &&
            a.maxZ > b.minZ + 0.001 &&
            a.minZ < b.maxZ - 0.001 &&
            Math.max(a.a.y, a.b.y) >= Math.min(b.a.y, b.b.y) &&
            Math.max(b.a.y, b.b.y) >= Math.min(a.a.y, a.b.y)
          )
            ok[4] = false;
        }
    }
    ok[8] &&=
      Math.hypot(s.sight.x - shot.x, s.sight.z - shot.z) >= 11.999 &&
      visible(s.sight, shot, segments.slice(Math.max(0, s.i - 1), s.i + 2));
    ok[8] &&= Math.hypot(s.enemy.x - s.cover.x, s.enemy.z - s.cover.z) < 3;
  }
  let start = 0;
  for (const end of [...plan.relays, segments.length]) {
    const values = layers.map((k) => {
      let time = 0;
      for (const s of segments.slice(start, end)) {
        const a = s.entry[k],
          b = s.exit[k];
        time +=
          Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y) / config.sprint +
          0.16 * s.threat +
          Number(k === 'R' && s.jumps.length > 0) * 0.25;
      }
      costs[k].push(time);
      return time;
    });
    ok[3] &&= Math.max(...values) <= Math.min(...values) * 1.25;
    start = end;
  }
  const repeat = sequence(route(seed)),
    skin = inspectShell(plan, segments);
  ok[6] = digest(segments) === digest(repeat) && skin.hash === inspectShell(plan, repeat).hash;
  // Reserve draws for the viewmodel, skyline, rain, effects and post-process.
  const draws = segments.map((s) => {
    const doorPanels = s.entry.I.y === s.exit.I.y ? 2 : 0;
    const hatches = s.devices.filter((d) => d.kind === 'hatch').length;
    const actorAndProjectiles = s.i === 0 ? 0 : 23;
    return 1 + doorPanels + hatches + actorAndProjectiles;
  });
  ok[7] =
    7 * (skin.maxTriangles + 30 * 12) + 5000 < 150000 &&
    draws.every(
      (_, i) => draws.slice(Math.max(0, i - 1), i + 6).reduce((total, n) => total + n, 50) <= 250,
    );
  ok.forEach((v, i) => (totals[i] += Number(v)));
}
const names = [
  'Достижимость',
  'Выход на улицу',
  'Два слоя',
  'Баланс',
  'Границы участков',
  'Метрики переходов',
  'Хеш геометрии',
  'Бюджет оболочки',
  'Укрытие и видимость',
];
console.table(
  Object.fromEntries(names.map((n, i) => [n, ((100 * totals[i]) / seeds).toFixed(2) + '%'])),
);
for (const [k, v] of Object.entries(costs)) {
  v.sort((a, b) => a - b);
  console.log(
    k,
    'секунды p10/p50/p90',
    ...[0.1, 0.5, 0.9].map((p) => v[Math.floor(v.length * p)].toFixed(1)),
  );
}
if (totals.some((v, i) => v / seeds < ([3, 7].includes(i) ? 0.98 : 1))) process.exitCode = 1;
