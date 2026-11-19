import * as T from 'three';
import { surface } from '../surfaces.js';
import { rng } from './route.js';
import { mix } from './segments.js';
const kinds = [
  'tile',
  'brick',
  'cement',
  'steel',
  'shutter',
  'asphalt',
  'crate',
  'bin',
  'stripe',
  'check',
  'poster',
  'sign',
  'graffiti',
];
let material;
export const weatherTime = { value: 0 };
const tiles = new Map();
export function atlas() {
  if (material) return material;
  const canvas =
    typeof document === 'undefined' ? new OffscreenCanvas(512, 512) : document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  for (const kind of kinds)
    for (let v = 0; v < 3; v++) {
      const i = tiles.size;
      tiles.set(kind + v, i);
      ctx.drawImage(surface(kind, v).map.image, (i % 8) * 64, Math.floor(i / 8) * 64);
    }
  for (const [i, text] of ['ЛАПША', 'РЕМОНТ', 'СЕКТОР 01', 'ПОЛИЦИЯ', 'СИГНАЛ', 'ЗАПЧАСТИ'].entries()) {
    const n = tiles.size,
      x = (n % 8) * 64,
      y = Math.floor(n / 8) * 64;
    tiles.set('label' + i, n);
    ctx.fillStyle = '#532c30';
    ctx.fillRect(x, y, 64, 64);
    ctx.strokeStyle = '#ff9a3c';
    ctx.strokeRect(x + 2, y + 5, 60, 54);
    ctx.fillStyle = '#ffbc76';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(text, x + 32, y + 34, 59);
    ctx.fillRect(x + 10, y + 43, 44, 1);
  }
  const n = tiles.size;
  tiles.set('plain', n);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect((n % 8) * 64, Math.floor(n / 8) * 64, 64, 64);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.minFilter = map.magFilter = T.NearestFilter;
  map.generateMipmaps = false;
  material = new T.MeshBasicMaterial({ map, vertexColors: true, side: T.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.weatherTime = weatherTime;
    shader.vertexShader =
      'attribute float tile;varying float vTile;varying vec3 streetPosition;\n' +
      shader.vertexShader.replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\nvTile=tile;streetPosition=position;',
      );
    shader.fragmentShader =
      'uniform float weatherTime;varying float vTile;varying vec3 streetPosition;\n' +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
     vec2 cell=vec2(mod(vTile,8.),7.-floor(vTile/8.));
     diffuseColor*=texture2D(map,(cell+(fract(vMapUv)*63.+.5)/64.)/8.);
     if(vTile>=15.&&vTile<18.){
       float along=vMapUv.y*4.;float across=vMapUv.x*4.;
       float ripple=.52+.32*sin(along*31.+sin(across*21.)+weatherTime*2.);
       float sheen=exp(-abs(across-1.)*3.)*exp(-abs(mod(along+1.,14.)-7.)*.44);
       diffuseColor.rgb+=vec3(.19,.062,.019)*sheen*ripple;
       diffuseColor.rgb+=vec3(.018,.024,.049)*(.5+.5*sin(along*2.+sin(across*5.)));
     }
   `,
      );
  };
  return material;
}
const faces = [
  [[0, 1, 3, 2], 0, 1, 0.72],
  [[5, 4, 6, 7], 0, 1, 0.9],
  [[4, 0, 2, 6], 2, 1, 0.74],
  [[1, 5, 7, 3], 2, 1, 0.9],
  [[2, 3, 7, 6], 0, 2, 1],
  [[4, 5, 1, 0], 0, 2, 0.54],
];
const colorCache = new Map();
function batch(group) {
  const mat = atlas(),
    pos = [],
    uv = [],
    color = [],
    tile = [],
    idx = [],
    shade = new T.Color();
  function face(points, w, h, kind, tint, brightness = 1) {
    const base = pos.length / 3;
    shade.set(tint).multiplyScalar(brightness);
    for (const [i, p] of points.entries()) {
      pos.push(p.x, p.y, p.z);
      color.push(shade.r, shade.g, shade.b);
      tile.push(tiles.get(kind) ?? tiles.get('plain'));
      uv.push(i === 1 || i === 2 ? w : 0, i >= 2 ? h : 0);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  function box(x, y, z, w, h, d, kind, tint = '#f0e1d0', label = false) {
    if (!colorCache.has(tint)) colorCache.set(tint, new T.Color(tint));
    const rgb = colorCache.get(tint),
      dims = [w, h, d],
      n = tiles.get(kind) ?? tiles.get('plain');
    for (const [indices, horizontal, vertical, light] of faces) {
      const base = pos.length / 3,
        uw = label ? 0.998 : dims[horizontal] / 4,
        vh = label ? 0.998 : dims[vertical] / 4;
      for (let j = 0; j < 4; j++) {
        const i = indices[j];
        pos.push(x + (i & 1 ? w : -w) / 2, y + (i & 2 ? h : -h) / 2, z + (i & 4 ? d : -d) / 2);
        color.push(rgb.r * light, rgb.g * light, rgb.b * light);
        tile.push(n);
        uv.push(j === 1 || j === 2 ? uw : 0, j >= 2 ? vh : 0);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  function finish() {
    const g = new T.BufferGeometry();
    for (const [key, values, size] of [
      ['position', pos, 3],
      ['uv', uv, 2],
      ['color', color, 3],
      ['tile', tile, 1],
    ])
      g.setAttribute(key, new T.Float32BufferAttribute(values, size));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const mesh = new T.Mesh(g, mat);
    mesh.userData.owned = true;
    group.add(mesh);
  }
  return { face, box, finish };
}
export function skin(plan) {
  atlas();
  return (group, s) => {
    for (const object of group.children) object.visible = false;
    const geometry = batch(group);
    describeSkin(plan, s, geometry);
    geometry.finish();
  };
}
export function describeSkin(plan, s, { face, box }) {
  const rnd = rng(plan.seed ^ Math.imul(s.i + 3, 0x45d9f3b)),
    c = plan.cells[s.i],
    v = s.i % 3;

  const place = (u, y, t, w, h, d, k, tint, label = false) =>
    box(
      c.x - c.dz * u + c.dx * t,
      y,
      c.z + c.dx * u + c.dz * t,
      c.dx ? d : w,
      h,
      c.dx ? w : d,
      k,
      tint,
      label,
    );
  for (const p of s.slabs) {
    const ox = (-p.dz * p.w) / 2,
      oz = (p.dx * p.w) / 2;
    face(
      [
        [p.a, 1],
        [p.a, -1],
        [p.b, -1],
        [p.b, 1],
      ].map(([q, n]) => ({ x: q.x + n * ox, y: q.y, z: q.z + n * oz })),
      p.w / 4,
      p.length / 4,
      (p.pavement
        ? 'cement'
        : p.link
          ? 'steel'
          : { G: 'asphalt', R: 'cement', I: 'tile', U: 'steel' }[p.layer]) + v,
      '#c5bcaf',
    );
    if (p.link)
      for (let j = 1; j < p.length; j += 1.25) {
        const q = mix(p.a, p.b, j / p.length);
        box(q.x + ox, q.y + 0.06, q.z + oz, 0.1, 0.12, 0.19, 'plain', '#4fe7ff');
      }
  }
  for (const d of s.devices) {
    for (const side of [-1, 1])
      box(
        d.x + side * 0.56,
        (d.low + d.high) / 2,
        d.z - 0.55,
        0.075,
        d.high - d.low,
        0.075,
        'plain',
        '#4fe7ff',
      );
    for (let y = d.low + 0.32; y < d.high; y += 0.36)
      box(d.x, y, d.z - 0.55, 1.14, 0.06, 0.08, 'steel' + v);
    for (const side of [-1, 1])
      box(d.x + side * 0.55, d.high + 0.025, d.z, 0.08, 0.05, 1.15, 'plain', '#4fe7ff');
  }
  const b = s.cover;
  box(b.x, 0.51, b.z, b.w, 1.02, b.d, 'bin' + v);
  box(b.x, 1.05, b.z, 1.07, 0.09, 1.08, 'stripe' + v);
  for (const side of [-1, 1]) {
    const edge = side < 0 ? -11 : 14;

    // Short frontage ends before a bend, leaving room for the inside lane.
    for (let bay = 0; bay < 4; bay++) {
      const wall = s.walls.find((b) => b.id === 'facade' + side + '_' + bay);
      if (!wall) continue;
      const t = 5 + bay * 7,
        wide = 6.85,
        high = wall.h - 2;
      place(edge + side * 2.2, high / 2 - 1, t, 4.3, high + 2, wide, (bay % 2 ? 'brick' : 'cement') + v);
      place(edge - side * 0.08, 1.55, t, 0.16, 3.1, wide - 0.3, 'shutter' + v);
      for (let row = 0; row < Math.floor(high / 3.2) - 1; row++)
        for (let win = 0; win < 2; win++) {
          const y = 4.4 + row * 3.2,
            z = t + (win ? 1.55 : -1.55);
          place(edge - side * 0.12, y, z, 0.2, 1.55, 1.9, 'steel' + v);
          place(
            edge - side * 0.25,
            y,
            z,
            0.08,
            1.28,
            1.62,
            'plain',
            rnd() < 0.21 ? '#ce864c' : '#31384d',
          );
          place(edge - side * 0.31, y, z, 0.06, 1.32, 0.09, 'plain', '#252938');
        }
      place(edge - side * 0.3, 3.18, t, 0.6, 0.17, wide, 'steel' + v);
      if (bay % 2 === 0) {
        place(edge - side * 0.45, 4.1, t - 2, 0.8, 0.7, 0.85, 'shutter' + v);
        place(edge - side * 0.48, 2, t + 2, 0.18, 4, 0.18, 'steel' + v);
      }
    }
  }
  // Street-level shop fronts stay outside the two-metre running strip.
  if (s.shop !== undefined) {
    const t = s.shop;
    place(-3.65, 1.6, t, 0.5, 3.2, 5, 'tile' + v);
    place(-3.33, 1.35, t, 0.12, 2.4, 3.6, 'shutter' + v);
    place(-3.1, 3.1, t, 0.9, 0.16, 5, 'plain', '#803332');
    place(-3.05, 3.85, t, 0.17, 0.95, 3.7, 'label' + (s.i % 6), '#ffd6a0', true);
    for (let j = 0; j < 3; j++)
      place(-3.15, 2.6, t - 1.6 + j * 1.45, 0.23, 0.47, 0.25, 'plain', '#ff9a3c');
    for (let j = 0; j < 8; j++)
      place(-2.96, 0.8 + j * 0.14, t + 2, 0.15, 0.14, 0.15, 'plain', j % 2 ? '#b9ab8c' : '#ff3b3b');
    place(-2.95, 1.1, t - 2, 0.1, 0.8, 0.63, 'poster' + v);
    for (let j = 0; j < 18; j++)
      place(
        -1.65 + rnd() * 0.8,
        0.009,
        t + (rnd() - 0.5) * 5,
        0.08 + rnd() * 0.24,
        0.01,
        0.08 + rnd() * 0.35,
        'plain',
        '#785035',
      );
  }
  for (const w of s.walls) {
    if (w.id.startsWith('facade') || w.id === 'shop') continue;
    box(w.x, w.y, w.z, w.w, w.h, w.d, w.kind + v);
    if (!w.id.includes('roof')) {
      const sign = w.id.includes('-1') ? -1 : 1;
      const u = -sign * 0.19;
      box(
        w.x - c.dz * u,
        w.y + 0.78,
        w.z + c.dx * u,
        c.dx ? 1.2 : 0.07,
        0.09,
        c.dx ? 0.07 : 1.2,
        'plain',
        w.id[0] === 'I' ? '#ff9a3c' : '#4fe7ff',
      );
    }
  }
  for (const layer of ['R', 'I', 'G', 'U']) {
    const a = s.entry[layer],
      b = s.exit[layer],
      w = a.w / 2;
    // Give slabs a visible edge and foundations down to the storm drain.
    for (const side of [-1, 1]) {
      const n = side * w;
      const edge = (q) => ({ x: q.x - c.dz * n, y: q.y, z: q.z + c.dx * n });
      const near = edge(a),
        far = edge(b);
      const base = (q) => ({ ...q, y: Math.min(-5.4, q.y - 0.18) });
      for (const [lo, hi] of [
        [0.02, 0.1],
        [0.44, 0.49],
        [0.94, 0.98],
      ]) {
        const l = mix(near, far, lo),
          r = mix(near, far, hi);
        face([l, r, base(r), base(l)], 1, 2, (layer === 'I' ? 'brick' : 'cement') + v, '#6e6558');
      }
    }
  }
  if (s.template.street === 'market')
    for (let j = 0; j < 4; j++)
      place(
        3.35 + 0.55 * (j % 2),
        0.32 + Math.floor(j / 2) * 0.57,
        16 + (j % 2),
        0.58,
        0.58,
        0.68,
        'crate' + (j % 3),
      );
  if (s.template.street === 'barricade') place(-2.75, 0.6, 16, 0.42, 1.2, 2.2, 'stripe' + v);
  if (s.template.room === 'kitchen') {
    const p = mix(s.entry.I, s.exit.I, 0.66);
    box(p.x - c.dz * 1.37, p.y + 0.54, p.z + c.dx * 1.37, 0.42, 1.08, 0.65, 'shutter' + v);
  }
  if (s.template.roof === 'skylight') {
    const p = mix(s.entry.R, s.exit.R, 0.6);
    box(p.x + c.dz * 1.9, p.y + 0.13, p.z - c.dx * 1.9, 0.9, 0.26, 1.7, 'tile' + v);
  }
  if (s.template.drain === 'water') {
    const p = mix(s.entry.U, s.exit.U, 0.55);
    box(p.x, p.y + 0.01, p.z, c.dx ? 4.6 : 2, 0.01, c.dx ? 2 : 4.6, 'plain', '#28484b');
  }
  for (let j = 0; j < 3; j++) {
    const y = 6.5 + j * 0.29,
      t = 11 + j * 2.35;
    place(0, y, t, 19, 0.035, 0.045, 'plain', '#242738');
  }
  if (s.i % 4 === 2) {
    place(0, 6.4, 22, 17, 0.45, 2.3, 'steel' + v);
    place(0, 6.12, 20.97, 12, 0.05, 0.12, 'plain', '#aa346b');
    place(0, 7.25, 21.04, 17, 0.13, 0.14, 'steel' + v);
    for (let k = -8; k <= 8; k += 2) place(k, 6.9, 21.04, 0.08, 0.9, 0.12, 'steel' + v);
  }
  if (s.i === plan.cells.length - 1) {
    place(0, 6.1, 31, 24, 0.75, 0.68, 'steel' + v);
    place(0, 5.66, 30.64, 18, 0.14, 0.1, 'plain', '#ff9a3c');
    for (const side of [-1, 1]) {
      place(side * 12, 3, 31, 0.8, 6, 1.1, 'steel' + v);
      place(side * 11.52, 2.8, 30.7, 0.14, 5.6, 0.12, 'plain', '#ff9a3c');
    }
    place(0, 7.15, 31, 5.7, 1.45, 0.29, 'label5', '#ffbc76', true);
  }
  if (s.i === 0) {
    place(0, -0.04, 2, 5, 0.08, 4, 'check0');
    place(0, 2.9, 0.3, 5, 0.18, 1.3, 'tile2');
    place(-2.35, 1.2, 1.8, 0.2, 2.4, 4, 'tile1');
    place(2.28, 1.3, 1.5, 0.2, 2.6, 3, 'shutter1');
    place(1.68, 0.82, 2.2, 0.92, 0.18, 2, 'crate1');
    for (const t of [1.5, 2.9]) place(1.8, 0.4, t, 0.12, 0.8, 0.12, 'steel0');
    place(1.65, 1.15, 2, 0.22, 0.4, 0.2, 'steel2');
    place(1.54, 1.21, 2.55, 0.12, 0.1, 0.38, 'steel1');
    place(-1.75, 0.5, 1, 0.78, 1, 1.7, 'steel0');
    place(-2.04, 1.2, 1, 0.12, 1.4, 1.62, 'tile2');
    place(-1.77, 1.09, 1, 0.32, 0.18, 0.8, 'steel1');
    place(-1.77, 1.13, 1.6, 0.24, 0.24, 0.23, 'cement0');
    place(-1.8, 2.27, 1.6, 0.52, 0.08, 0.52, 'plain', '#7dff1a');
    place(-1.48, 0.17, 3, 1.05, 0.34, 1.25, 'steel0');
    place(-1.91, 1.12, 3, 0.18, 2.15, 1.2, 'steel2');
    place(-1.48, 2.25, 3, 1.05, 0.18, 1.25, 'shutter1');
    for (const dx of [-0.18, 0.18]) {
      place(-1.55 + dx, 0.65, 3, 0.14, 0.74, 0.16, 'steel1');
      place(-1.55 + dx * 1.6, 1.27, 3, 0.12, 0.54, 0.16, 'cement0');
    }
    place(-1.55, 1.22, 3, 0.36, 0.48, 0.22, 'steel0');
    for (let k = 0; k < 4; k++)
      place(-1.55, 1.06 + k * 0.095, 2.85, 0.35, 0.035, 0.07, 'plain', '#b9ab8c');
    place(-1.55, 1.65, 3, 0.24, 0.27, 0.2, 'cement1');
    place(-1.55, 1.68, 2.89, 0.19, 0.034, 0.03, 'plain', '#4fe7ff');
    place(-1.55, 2.12, 3, 0.55, 0.06, 0.62, 'plain', '#7dff1a');
    place(1.43, 1.42, 2.7, 0.08, 0.98, 0.08, 'steel1');
    place(1.27, 1.86, 2.7, 0.47, 0.09, 0.3, 'plain', '#ff9a3c');
    for (let k = 0; k < 2; k++) {
      place(1.59, 1.06, 1.6 + k * 0.45, 0.23, 0.28, 0.16, 'cement' + k);
      place(1.59, 1.09, 1.51 + k * 0.45, 0.16, 0.035, 0.024, 'plain', '#242738');
    }
  }
  const r = mix(s.entry.R, s.exit.R, 0.32);
  box(r.x + c.dz * 2, r.y + 0.6, r.z - c.dx * 2, 1.1, 1.2, 1.1, 'steel' + v);
  if (s.jumps.length) {
    const p = s.jumps[0].b;
    box(p.x, p.y + 0.015, p.z, c.dx ? 0.12 : 2.8, 0.03, c.dx ? 2.8 : 0.12, 'stripe' + v);
  }
  if (s.entry.I.y === s.exit.I.y) {
    const p = mix(s.entry.I, s.exit.I, 0.76);
    for (const sign of [-1, 1])
      box(
        p.x - c.dz * sign * 1.38,
        p.y + 1.18,
        p.z + c.dx * sign * 1.38,
        c.dx ? 0.16 : 0.12,
        2.36,
        c.dx ? 0.12 : 0.16,
        'plain',
        '#ff9a3c',
      );
    box(p.x, p.y + 2.4, p.z, c.dx ? 0.18 : 2.86, 0.12, c.dx ? 2.86 : 0.18, 'plain', '#ff9a3c');
  }
  if (plan.relays.includes(s.i) || s.i === plan.cells.length - 1) {
    place(-2, 3, 2, 0.35, 6, 0.35, 'steel' + v);
    place(-2, 5.6, 2, 0.55, 0.85, 0.55, 'plain', '#7dff1a');
  }
}
export function skyline(scene, plan) {
  const group = new T.Group(),
    { box, finish } = batch(group);
  for (const p of plan.cells.filter((c) => c.i % 3 === 0)) {
    for (const sign of [-1, 1]) {
      const n = 22 + (p.i % 4) * 7;
      box(p.x - sign * p.dz * 40, n / 2, p.z + sign * p.dx * 40, 17, n, 20, 'cement1', '#363d59');
    }
  }
  finish();
  scene.add(group);
  const tower = new T.Group(),
    b = batch(tower);
  for (const [w, y, h] of [
    [30, 21, 42],
    [22, 59, 35],
    [13, 87, 24],
    [4, 105, 14],
  ])
    b.box(0, y, 0, w, h, w, 'steel2', '#717e95');
  for (let y = 18; y < 101; y += 6) {
    const width = y < 42 ? 30 : y < 76 ? 22 : 13;
    for (const side of [-1, 1]) {
      b.box(
        side * (width * 0.5 + 0.04),
        y,
        0,
        0.11,
        0.42,
        width * 0.52,
        'plain',
        y % 12 ? '#4fe7ff' : '#ff3b3b',
      );
      b.box(0, y, side * (width * 0.5 + 0.04), width * 0.52, 0.42, 0.11, 'plain', '#4fe7ff');
    }
  }
  b.box(0, 116, 0, 1.05, 13, 1.05, 'steel1', '#8f939f');
  b.box(0, 123, 0, 0.9, 0.9, 0.9, 'plain', '#ff3b3b');
  b.finish();
  scene.add(tower);
  tower.children[0].material = tower.children[0].material.clone();
  tower.children[0].material.onBeforeCompile = material.onBeforeCompile;
  tower.children[0].material.fog = false;
  return (pos) => {
    const dx = plan.tower.x - pos.x,
      dz = plan.tower.z - pos.z,
      dist = Math.hypot(dx, dz),
      f = 80 / dist;
    tower.position.set(pos.x + dx * f, 0, pos.z + dz * f);
    tower.scale.setScalar(Math.min(1, f * 3));
  };
}
