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
     vec2 coords=vMapUv;
     if((vTile>=15.&&vTile<18.)||(vTile>=27.&&vTile<30.))coords=streetPosition.xz*.25;
     diffuseColor*=texture2D(map,(cell+(fract(coords)*63.+.5)/64.)/8.);
     if(vTile>=15.&&vTile<18.){
       float along=streetPosition.z;float across=streetPosition.x;
       float ripple=.8+.2*sin(along*.8+weatherTime*.4);
       float sheen=exp(-abs(across-1.)*3.)*exp(-abs(mod(along+1.,14.)-7.)*.44);
       diffuseColor.rgb+=vec3(.065,.027,.014)*sheen*ripple;
       diffuseColor.rgb+=vec3(.006,.009,.014)*(.5+.5*sin(along*2.+sin(across*5.)));
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
  const c = plan.cells[s.i],
    v = s.i % 3,
    rnd = rng(plan.seed ^ Math.imul(s.i + 3, 0x45d9f3b));
  const at = (u, y, t) => ({ x: c.x - c.dz * u + c.dx * t, y, z: c.z + c.dx * u + c.dz * t });
  const place = (u, y, t, w, h, d, k, tint, label = false) => {
    const p = at(u, y, t);
    box(p.x, p.y, p.z, c.dx ? d : w, h, c.dx ? w : d, k, tint, label);
  };
  function floor(p, kind) {
    const x = (-p.dz * p.w) / 2,
      z = (p.dx * p.w) / 2;
    face(
      [
        [p.a, 1],
        [p.a, -1],
        [p.b, -1],
        [p.b, 1],
      ].map(([q, n]) => ({ x: q.x + n * x, y: q.y, z: q.z + n * z })),
      p.w / 4,
      p.length / 4,
      kind,
      '#b1aaa0',
    );
  }
  // Tiles are owned once across the whole route, so a corner never renders two ground faces.
  for (const tile of s.ground) {
    const kind = tile.dist < 3.7 ? 'asphalt' : 'cement';
    face(
      [
        { x: tile.x - 1, y: 0, z: tile.z - 1 },
        { x: tile.x + 1, y: 0, z: tile.z - 1 },
        { x: tile.x + 1, y: 0, z: tile.z + 1 },
        { x: tile.x - 1, y: 0, z: tile.z + 1 },
      ],
      0.5,
      0.5,
      kind + v,
      kind === 'asphalt' ? '#8d99a2' : '#777c85',
    );
  }
  for (const w of s.architecture)
    box(w.x, w.y, w.z, w.dx ? w.d : w.w, w.h, w.dx ? w.w : w.d, w.kind, '#aaa69e');
  // The service floor follows rooms; its partitions, ceiling and facade belong to the same building.
  for (const p of s.slabs) if (!p.link && (p.layer === 'U' || p.bridge)) floor(p, 'steel' + v);
  for (const t of s.roomFloor) {
    face(
      [
        { x: t.x - 0.5, y: 0.04, z: t.z - 0.5 },
        { x: t.x + 0.5, y: 0.04, z: t.z - 0.5 },
        { x: t.x + 0.5, y: 0.04, z: t.z + 0.5 },
        { x: t.x - 0.5, y: 0.04, z: t.z + 0.5 },
      ],
      0.25,
      0.25,
      (s.template.room === 'kitchen' ? 'tile' : 'check') + v,
      '#777c78',
    );
  }
  for (const link of s.links) {
    if (link.kind !== 'stair') continue;
    for (const p of link.pieces) {
      const rise = p.b.y - p.a.y;
      if (Math.abs(rise) < 0.1) {
        floor(p, 'steel' + v);
        continue;
      }
      const count = Math.ceil(Math.abs(rise) / 0.18),
        step = p.length / count;
      for (let j = 0; j < count; j++) {
        const q = mix(p.a, p.b, (j + 0.5) / count),
          y = p.a.y + (rise * (j + 1)) / count;
        box(
          q.x,
          y - 0.14,
          q.z,
          Math.abs(p.dx) > 0.5 ? step : 1.6,
          0.28,
          Math.abs(p.dx) > 0.5 ? 1.6 : step,
          'steel' + v,
          '#899199',
        );
      }
      for (const side of [-1, 1]) {
        const ox = -p.dz * side * 0.83,
          oz = p.dx * side * 0.83;
        for (let j = 0; j <= 4; j++) {
          const q = mix(p.a, p.b, j / 4);
          box(q.x + ox, q.y + 0.48, q.z + oz, 0.055, 0.96, 0.055, 'plain', '#444f5a');
          if (j < 4) {
            const r = mix(p.a, p.b, (j + 0.5) / 4);
            box(
              r.x + ox,
              r.y + 0.94,
              r.z + oz,
              Math.abs(p.dx) > 0.5 ? p.length / 4 : 0.07,
              0.07,
              Math.abs(p.dx) > 0.5 ? 0.07 : p.length / 4,
              'plain',
              j === 0 ? '#4fe7ff' : '#586875',
            );
          }
        }
      }
    }
  }
  const b = s.cover;
  box(b.x, 0.55, b.z, b.w, 1.1, b.d, 'bin' + v, '#a2a98d');
  box(b.x, 1.13, b.z, b.w + 0.08, 0.12, b.d + 0.08, 'steel' + v);
  for (const side of [-1, 1])
    box(b.x + side * 0.4, 0.12, b.z + 0.45, 0.14, 0.23, 0.18, 'plain', '#252b32');
  // Windows, sill depths, downpipes and signs are attached to street-facing walls.
  for (const side of [-1, 1]) {
    const edge = side < 0 ? -5.49 : 4.43,
      front = edge - side * 0.04;
    for (let bay = 0; bay < 4; bay++) {
      const t = 3.7 + bay * 7.6;
      const stair = side < 0 && s.links.some((l) => l.to === 'R') && t < 12.2;
      if (stair) continue;
      if (side < 0 && s.jumps.some((g) => Math.abs(t - 16) < 2.5)) continue;
      for (let row = 0; row < 2; row++) {
        const y = 4.6 + row * 3.1;
        place(front, y, t, 0.12, 1.68, 1.66, 'steel' + v, '#696c71');
        place(
          front - side * 0.09,
          y,
          t,
          0.055,
          1.4,
          1.38,
          'plain',
          rnd() < 0.28 ? '#a67548' : '#202e42',
        );
        place(front - side * 0.13, y, t, 0.06, 1.46, 0.055, 'plain', '#353943');
        place(front - side * 0.18, y - 0.86, t, 0.4, 0.12, 1.94, 'cement' + v);
      }
      if (bay % 2 === 0) {
        place(front - side * 0.25, 3.6, t + 1.5, 0.6, 0.65, 0.9, 'shutter' + v);
        place(front - side * 0.62, 3.6, t + 1.5, 0.06, 0.5, 0.76, 'steel' + v);
      }
      if (side < 0 || [6, 26].every((door) => Math.abs(t + 2.8 - door) > 1.35))
        place(front - side * 0.08, 4.5, t + 2.8, 0.14, 9, 0.14, 'steel' + v, '#6e746f');
    }
  }
  for (const t of [6, 26]) {
    for (const side of [-1, 1]) place(4.36, 1.35, t + side * 1.08, 0.11, 2.7, 0.1, 'plain', '#c27a39');
    place(4.34, 2.72, t, 0.13, 0.12, 2.28, 'plain', '#ff9a3c');
    place(4.31, 2.96, t, 0.12, 0.32, 2.05, 'label' + (s.i % 6), '#e6b179', true);
  }
  for (const t of [11, 22]) {
    const u = t === 11 ? 8.4 : 9;
    place(u, 2.35, t - 0.15, 1.35, 0.12, 0.04, 'plain', '#ff9a3c');
  }
  const shopT = 16;
  place(4.15, 3.15, shopT, 0.9, 0.13, 6.8, 'plain', '#6e292a');
  place(4.26, 3.93, shopT, 0.21, 1.14, 3.5, 'label' + (s.i % 6), '#ffb87a', true);
  place(4.32, 1.36, 17.1, 0.08, 2.14, 3.7, 'shutter' + v, '#898176');
  for (let j = 0; j < 3; j++) place(3.92, 2.75, 14 + j * 1.5, 0.28, 0.43, 0.28, 'plain', '#ff9a3c');
  if (s.template.street === 'barber' || s.i < 2) {
    place(4.03, 1.7, 13, 0.19, 1.25, 0.19, 'steel' + v);
    for (let j = 0; j < 9; j++)
      place(
        3.97,
        1.16 + j * 0.13,
        13,
        0.22,
        0.12,
        0.23,
        'plain',
        j % 3 === 0 ? '#b9ab8c' : j % 3 === 1 ? '#ff3b3b' : '#3a63ff',
      );
  }
  for (const t of [9, 21]) {
    place(12.5, 0.48, t, 1.7, 0.96, 1.1, s.template.room === 'kitchen' ? 'shutter' + v : 'crate' + v);
    place(12.5, 1.01, t, 1.86, 0.08, 1.24, 'steel' + v);
  }
  if (s.i === 0) {
    place(12.45, 0.2, 2.5, 1.7, 0.4, 2.4, 'steel0');
    place(13.16, 1.3, 2.5, 0.18, 2.2, 2.3, 'steel1');
    place(12.45, 2.45, 2.5, 1.75, 0.16, 2.4, 'steel1');
    place(12.45, 2.34, 2.5, 1.1, 0.07, 1.4, 'plain', '#7dff1a');
    place(12.45, 1.25, 2.5, 0.44, 0.56, 0.28, 'steel2');
    for (const side of [-1, 1]) {
      place(12.45 + side * 0.17, 0.67, 2.5, 0.13, 0.64, 0.15, 'steel1');
      place(12.45 + side * 0.32, 1.25, 2.5, 0.12, 0.52, 0.16, 'cement0');
    }
    place(12.45, 1.78, 2.5, 0.27, 0.31, 0.25, 'steel1');
    place(12.45, 1.81, 2.35, 0.2, 0.04, 0.04, 'plain', '#4fe7ff');
    place(12.45, 0.23, 6, 2.3, 0.46, 1.7, 'crate1');
    place(12.45, 0.91, 6, 2.4, 0.12, 1.8, 'steel0');
    for (const side of [-1, 1]) place(12.45 + side * 0.9, 0.5, 6, 0.12, 0.9, 0.14, 'steel1');
    place(12.2, 1.02, 5.7, 0.12, 0.14, 0.55, 'steel2');
    place(12.2, 1.08, 5.6, 0.15, 0.1, 0.1, 'cement1');
    place(13.1, 1.53, 6.5, 0.09, 1.05, 0.09, 'steel1');
    place(12.85, 2.06, 6.5, 0.7, 0.1, 0.5, 'plain', '#ff9a3c');
    place(13.78, 1.6, 6, 0.08, 1.5, 1.45, 'steel0');
  }
  // Roof doors, chimney flashing and narrow catwalks belong to separate houses.
  place(-7.1, 10.55, 23.92, 1.05, 1.88, 0.09, 'steel' + v);
  place(-7.1, 11.57, 23.84, 1.2, 0.08, 0.08, 'plain', '#4fe7ff');
  place(-12.05, 11.85, 7, 0.18, 0.9, 0.18, 'steel' + v);
  for (const t of [14.58, 17.42]) place(-9.5, 9.62, t, 7.7, 0.04, 0.18, 'stripe' + v, '#b9ab8c');
  for (const p of s.slabs.filter((p) => p.bridge)) {
    for (const sign of [-1, 1]) {
      for (const q of [p.a, p.b])
        box(q.x - p.dz * sign * 0.77, q.y + 0.5, q.z + p.dx * sign * 0.77, 0.07, 1, 0.07, 'steel' + v);
      const q = mix(p.a, p.b, 0.5);
      box(
        q.x - p.dz * sign * 0.77,
        q.y + 0.99,
        q.z + p.dx * sign * 0.77,
        Math.abs(p.dx) > 0.5 ? p.length : 0.06,
        0.06,
        Math.abs(p.dx) > 0.5 ? 0.06 : p.length,
        'plain',
        '#586875',
      );
    }
  }
  for (const d of s.devices) {
    for (const side of [-1, 1]) box(d.x + side * 0.74, -2.25, d.z, 0.07, 4.5, 0.07, 'plain', '#4fe7ff');
    for (let y = -4.2; y < 0; y += 0.35) box(d.x, y, d.z + 0.7, 1.5, 0.06, 0.08, 'steel' + v);
    for (const side of [-1, 1]) box(d.x + side * 1.02, 0.025, d.z, 0.04, 0.05, 2, 'plain', '#4fe7ff');
  }
  // Ceiling pipes and small lamps make the drain read as an enclosed utility space.
  for (const t of [4, 12, 20, 28]) {
    place(-1.72, -1.65, t, 0.15, 0.15, 7.5, 'steel' + v);
    place(1.97, -1.55, t, 0.06, 0.18, 0.78, 'plain', '#4f7c87');
  }
  for (let j = 0; j < 3; j++) place(0, 7.2 + j * 0.24, 8 + j * 6, 9.9, 0.025, 0.035, 'plain', '#1f2733');
  if (s.i % 5 === 3) {
    place(0, 6.05, 24, 10.4, 0.44, 1.8, 'steel' + v);
    for (const side of [-1, 1]) place(side * 4.95, 3.0, 24, 0.28, 6, 0.28, 'steel' + v);
    place(0, 5.8, 23.25, 8, 0.06, 0.08, 'plain', '#803557');
  }
  if (plan.relays.includes(s.i)) {
    place(2.9, 2.25, 1, 0.22, 4.5, 0.22, 'steel' + v);
    place(2.9, 4.3, 1, 0.5, 0.4, 0.5, 'plain', '#7dff1a');
  }
  if (s.i === plan.cells.length - 1) {
    for (const side of [-1, 1]) place(side * 4.5, 3, 31, 0.65, 6, 0.8, 'cement' + v);
    place(0, 5.8, 31, 9.6, 0.7, 0.8, 'steel' + v);
    place(0, 5.4, 30.55, 8, 0.1, 0.08, 'plain', '#ff9a3c');
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
