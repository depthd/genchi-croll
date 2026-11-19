import assert from 'node:assert/strict';
import { route } from '../src/gen/route.js';
import { sequence } from '../src/gen/sequencer.js';
import { advance } from '../src/gen/physics.js';
import { layers, steerBot } from '../src/gen/segments.js';
const seeds = Number(process.argv[process.argv.indexOf('--seeds') + 1]) || 100;
let transitions = 0;
function walk(body, points, near, label) {
  for (const b of points.slice(1)) {
    const a = { ...body },
      length = Math.hypot(b.x - a.x, b.z - a.z),
      steps = Math.ceil(length / (8 / 60));
    for (let n = 0; n < steps; n++)
      advance(body, near, (b.x - a.x) / steps, (b.z - a.z) / steps, 1 / 60);
    assert(
      Math.hypot(body.x - b.x, body.z - b.z) < 0.06 && Math.abs(body.y - b.y) < 0.45,
      label + JSON.stringify({ body, b }),
    );
  }
}
for (let seed = 0; seed < seeds; seed++) {
  const segments = sequence(route(seed));
  for (const layer of layers) {
    const body = { ...segments[0].entry[layer], vy: 0, grace: 0.1 };
    for (const seg of segments) {
      const near = segments.slice(Math.max(0, seg.i - 1), seg.i + 2);
      let finished = false;
      for (let n = 0; n < 600; n++) {
        const cmd = steerBot(body, seg, layer, 1 / 60);
        if (cmd.arrived) {
          finished = true;
          break;
        }
        advance(body, near, cmd.dx, cmd.dz, 1 / 60, cmd.jump);
        assert(body.y >= seg.entry[layer].y - 0.5, 'Провал ' + [seed, seg.i, layer]);
      }
      assert(finished, 'Застревание ' + [seed, seg.i, layer, JSON.stringify(body)]);
    }
  }
  for (const seg of segments)
    for (const link of seg.links)
      for (const reverse of [false, true]) {
        const points = reverse ? link.points.toReversed() : link.points;
        const body = {
          ...points[0],
          vy: 0,
          grace: 0.1,
          lastDevice: seg.devices.find((d) => Math.hypot(d.x - points[0].x, d.z - points[0].z) < 0.5),
        };
        walk(
          body,
          points,
          segments.slice(Math.max(0, seg.i - 1), seg.i + 2),
          'Переход ' + [seed, seg.i, link.to, reverse],
        );
        transitions++;
      }
  for (const seg of segments)
    for (const d of seg.devices)
      for (const end of [d.low, d.high]) {
        const body = { x: d.x, y: end === d.low ? d.high : d.low, z: d.z, vy: 0, grace: 0.1 };
        for (let n = 0; n < 65; n++) advance(body, [seg], 0.001, 0, 1 / 60);
        assert(Math.abs(body.y - end) < 0.05, 'Люк ' + [seed, seg.i]);
        transitions++;
      }
}
console.log(seeds + ' seeds × 4 routes, ' + transitions + ' stair/door/hatch traversals passed');
