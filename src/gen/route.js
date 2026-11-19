import { config } from '../config.js';
export function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export function route(seed) {
  const random = rng(seed),
    cells = [],
    turns = [],
    legs = [];
  let x = 0,
    z = 0;
  // Northbound legs separate the cross streets by at least three blocks.
  for (let i = 0; i < 12; i++) legs.push(4 + Math.floor(random() * 3));
  const target = 60 + Math.floor(random() * 6);
  let count = legs.reduce((a, b) => a + b);
  while (count !== target) {
    const n = Math.floor(random() * legs.length),
      d = Math.sign(target - count);
    if (legs[n] + d >= 3 && legs[n] + d <= 6) {
      legs[n] += d;
      count += d;
    }
  }
  for (let leg = 0; leg < legs.length; leg++) {
    const dx = leg % 2 ? (random() < 0.5 ? -1 : 1) : 0,
      dz = leg % 2 ? 0 : -1;
    if (leg) turns.push(cells.length);
    for (let i = 0; i < legs[leg]; i++) {
      cells.push({ i: cells.length, x, z, dx, dz });
      x += dx * config.segment;
      z += dz * config.segment;
    }
  }
  const relays = [400, 800, 1200, 1600].map((m) =>
    turns.reduce((a, b) =>
      Math.abs(b * config.segment - m) < Math.abs(a * config.segment - m) ? b : a,
    ),
  );
  return {
    seed,
    cells,
    legs,
    turns,
    relays,
    length: count * config.segment,
    tower: { x: x + cells.at(-1).dx * 160, z: z + cells.at(-1).dz * 160 },
  };
}
export function drawMap(canvas, plan, position, segments) {
  const c = canvas.getContext('2d'),
    xs = plan.cells.map((p) => p.x),
    zs = plan.cells.map((p) => p.z);
  const x0 = Math.min(...xs) - 32,
    z0 = Math.min(...zs) - 32,
    scale = Math.min(
      canvas.width / (Math.max(...xs) - x0 + 48),
      canvas.height / (Math.max(...zs) - z0 + 48),
    );
  c.fillStyle = '#0a0f24';
  c.fillRect(0, 0, canvas.width, canvas.height);
  const dot = (x, z, r, color) => {
    c.fillStyle = color;
    c.fillRect((x - x0) * scale - r, (z - z0) * scale - r, r * 2, r * 2);
  };
  for (const p of plan.cells) {
    c.strokeStyle = '#6e6558';
    c.beginPath();
    c.moveTo((p.x - x0) * scale, (p.z - z0) * scale);
    c.lineTo((p.x + p.dx * 32 - x0) * scale, (p.z + p.dz * 32 - z0) * scale);
    c.stroke();
    dot(p.x, p.z, plan.relays.includes(p.i) ? 3 : 1, plan.relays.includes(p.i) ? '#7dff1a' : '#4fe7ff');
    if (segments)
      for (const slab of segments[p.i].slabs) {
        c.strokeStyle = slab.link
          ? '#82919c'
          : { G: '#b9ab8c', R: '#4fe7ff', I: '#ff9a3c', U: '#ff3fa4' }[slab.layer];
        c.beginPath();
        c.moveTo((slab.a.x - x0) * scale, (slab.a.z - z0) * scale);
        c.lineTo((slab.b.x - x0) * scale, (slab.b.z - z0) * scale);
        c.stroke();
        if (slab.link) dot(slab.b.x, slab.b.z, 1, '#b9ab8c');
      }
  }
  dot(position.x, position.z, 3, '#ff3b3b');
  c.font = '12px monospace';
  const names = [
    ['Улица', '#b9ab8c'],
    ['Крыши', '#4fe7ff'],
    ['Интерьер', '#ff9a3c'],
    ['Стоки', '#ff3fa4'],
    ['Реле', '#7dff1a'],
  ];
  names.forEach(([label, color], i) => {
    c.fillStyle = color;
    c.fillText(label, 8 + i * 72, canvas.height - 10);
  });
}
