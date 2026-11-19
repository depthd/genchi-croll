import assert from 'node:assert/strict';
import { route } from '../src/gen/route.js';
import { sequence } from '../src/gen/sequencer.js';
import { advance } from '../src/gen/physics.js';
import { layers } from '../src/gen/segments.js';
let transitions = 0;
const seeds = Number(process.argv[process.argv.indexOf('--seeds') + 1]) || 100;
for (let seed = 0; seed < seeds; seed++) {
  const segments = sequence(route(seed));
  for (const layer of layers) {
    const body = { ...segments[0].entry[layer], vy: 0, grace: 0.1 };
    for (const seg of segments) {
      const near = segments.slice(Math.max(0, seg.i - 1), seg.i + 2),
        end = seg.exit[layer];
      const length = Math.hypot(end.x - body.x, end.z - body.z),
        steps = Math.ceil(length / (8 / 60));
      const dx = (end.x - body.x) / steps,
        dz = (end.z - body.z) / steps;
      let jumped = false;
      for (let i = 0; i < steps; i++) {
        const lip = seg.jumps.find((g) => g.layer === layer)?.a;
        const jump = !!lip && !jumped && Math.hypot(body.x - lip.x, body.z - lip.z) < 0.24;
        advance(body, near, dx, dz, 1 / 60, jump);
        jumped ||= jump;
        assert(
          body.y >= Math.min(end.y, seg.entry[layer].y) - 0.45,
          'Провал ' + [seed, seg.i, layer, i, body.y],
        );
      }
      assert(
        Math.hypot(body.x - end.x, body.z - end.z) < 0.05 && Math.abs(body.y - end.y) < 0.46,
        'Стык ' + [seed, seg.i, layer, body.y, end.y],
      );
    }
  }
  for (const seg of segments)
    for (const device of seg.devices)
      for (const end of [device.high, device.low]) {
        const start = end === device.high ? device.low : device.high;
        const body = { x: device.x, y: start, z: device.z, vy: 0, grace: 0.1 };
        for (let i = 0; i < Math.ceil((Math.abs(end - start) / 4.5) * 60) + 1; i++)
          advance(body, [seg], 0.005, 0, 1 / 60);
        assert(Math.abs(body.y - end) < 0.05, 'Шахта ' + [seed, seg.i, device.kind]);
        transitions++;
      }
  for (const seg of segments)
    for (const link of seg.links)
      for (const backwards of [false, true]) {
        const a = backwards ? link.b : link.a,
          b = backwards ? link.a : link.b;
        const body = { ...a, vy: 0, grace: 0.1 },
          near = segments.slice(Math.max(0, seg.i - 1), seg.i + 2);
        const steps = Math.ceil(link.length / (8 / 60));
        for (let i = 0; i < steps; i++)
          advance(body, near, (b.x - a.x) / steps, (b.z - a.z) / steps, 1 / 60);
        assert(
          Math.hypot(body.x - b.x, body.z - b.z) < 0.1 && Math.abs(body.y - b.y) < 0.5,
          'Переход ' + [seed, seg.i, link.from, link.to],
        );
        transitions++;
      }
}
console.log(
  seeds + ' seeds × ' + layers.length + ' layers passed; ' + transitions + ' transitions passed',
);
