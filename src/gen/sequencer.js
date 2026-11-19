import { assignSight } from './sight.js';
import { placeWalls } from './walls.js';
import { config } from '../config.js';
import { rng } from './route.js';
import { templates, buildSegment, compatible, layers } from './segments.js';
export function sectionCosts(section) {
  return layers.map((k) =>
    section.reduce((sum, s) => {
      const points = s.paths[k];
      const length = points
        .slice(1)
        .reduce((n, p, i) => n + Math.hypot(p.x - points[i].x, p.z - points[i].z, p.y - points[i].y), 0);
      return (
        sum +
        length / config.sprint +
        config.threatTime * s.threat +
        Number(k === 'R' && s.jumps.length > 0) * config.jumpTime
      );
    }, 0),
  );
}
export function sequence(plan) {
  let start = 0;
  const result = [];
  for (const end of [...plan.relays, plan.cells.length]) {
    let accepted = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const section = assemble(plan, start, end, result, attempt);
      const costs = sectionCosts(section);
      if (Math.max(...costs) > Math.min(...costs) * 1.25) continue;
      result.push(...section);
      accepted = true;
      break;
    }
    if (!accepted) throw Error('Баланс участка ' + start + '–' + end + ', сид ' + plan.seed);
    start = end;
  }
  return assignSight(plan, placeWalls(plan, result));
}
function assemble(plan, start, end, previous, attempt) {
  const result = [];
  for (const c of plan.cells.slice(start, end)) {
    const random = rng((plan.seed + attempt) ^ Math.imul(c.i + 1, 2654435761));
    const recent = previous
        .slice(-5)
        .concat(result)
        .slice(-5)
        .map((s) => s.id),
      progress = c.i / plan.cells.length;
    const choices = templates.filter((t) => !recent.includes(t.id) && t.minProgress <= progress);
    const weight = (t) => t.weight * (1 + t.threat * progress);
    let ticket = random() * choices.reduce((n, t) => n + weight(t), 0);
    const chosen = choices.find((t) => (ticket -= weight(t)) < 0) ?? choices.at(-1);
    const s = buildSegment(plan, c.i, chosen);
    if (c.i && !layers.every((k) => compatible((result.at(-1) ?? previous.at(-1)).exit[k], s.entry[k])))
      throw Error('Несовместимый порт ' + c.i);
    result.push(s);
  }
  return result;
}
