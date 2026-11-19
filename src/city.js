import * as THREE from 'three';

export function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const random = randomGenerator(91);
const cube = new THREE.BoxGeometry(1, 1, 1);
export const solid = (color) => new THREE.MeshLambertMaterial({ color });
export const glow = (color) => new THREE.MeshBasicMaterial({ color });

export function block(parent, material, x, y, z, width, height, depth) {
  const mesh = new THREE.Mesh(cube, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(width, height, depth);
  parent.add(mesh);
  return mesh;
}

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function grime(base, kind) {
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2300; i++) {
      ctx.fillStyle = random() < .56 ? '#07081034' : '#c8bbad24';
      ctx.fillRect(random() * w | 0, random() * h | 0, 1 + random() * 3 | 0, 1 + random() * 4 | 0);
    }
    if (kind === 'brick') {
      ctx.fillStyle = '#111016a0';
      for (let y = 0; y < h; y += 8) {
        ctx.fillRect(0, y, w, 1);
        for (let x = (y % 16 ? 8 : 0); x < w; x += 16) ctx.fillRect(x, y, 1, 8);
      }
    }
    if (kind === 'metal') {
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = random() < .5 ? '#37251df0' : '#8c795273';
        ctx.fillRect(random() * w | 0, 32 + random() * 32 | 0, 1 + random() * 6 | 0, 1 + random() * 3 | 0);
      }
      ctx.fillStyle = '#c4c9a9';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('014', 8, 30);
    }
  });
}

function tiled(texture, x, y) {
  const copy = texture.clone();
  copy.wrapS = copy.wrapT = THREE.RepeatWrapping;
  copy.repeat.set(x, y);
  copy.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ map: copy });
}

function sign(scene, text, color, background, x, y, z, rotation, width) {
  const tex = canvasTexture(128, 36, (ctx) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 128, 36);
    ctx.strokeStyle = color;
    ctx.strokeRect(3, 3, 122, 30);
    ctx.fillStyle = color;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, 64, 26);
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 36 / 128), new THREE.MeshBasicMaterial({ map: tex }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotation;
  scene.add(mesh);
}

export function buildCity(scene) {
  const colliders = [];
  const street = grime('#4d4b59', 'street');
  const bricks = grime('#58525a', 'brick');
  const concrete = grime('#484550', 'street');
  const tar = solid('#1f2536');
  const pipe = solid('#53494a');
  const frames = solid('#252431');
  const glass = [glow('#17182a'), glow('#363d65'), glow('#93724d'), glow('#262c49')];
  const green = new THREE.MeshLambertMaterial({ map: grime('#347b51', 'metal') });
  const rail = solid('#2f7253');
  const black = solid('#242b2e');
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 80), tiled(street, 28, 31));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -23;
  scene.add(floor);

  function wall(x, y, z, w, h, d, material) {
    const mesh = block(scene, material, x, y, z, w, h, d);
    colliders.push(mesh);
    return mesh;
  }

  const branches = [
    { side: 1, z: -12 },
    { side: -1, z: -24 },
    { side: 1, z: -36 }
  ];
  const halfOpening = 1.55;
  const buildingDepth = 5;
  const end = tiled(bricks, 4, 5);
  const sidewalk = tiled(concrete, 1, 14);

  function facade(side, near, far) {
    const length = near - far;
    const z = (near + far) / 2;
    const long = tiled(bricks, length / 3, 5);
    wall(side * (4 + buildingDepth / 2), 7, z, buildingDepth, 14, length, [long, long, end, end, end, end]);
    block(scene, sidewalk, side * 3.75, .035, z, .48, .07, length);
    block(scene, pipe, side * 3.91, 4.15, z, .16, .16, length);
    for (let panel = near - 1.45; panel > far + 1.35; panel -= 4.2) {
      block(scene, pipe, side * 3.93, 2.65, panel - 1, .13, 5.3, .13);
      for (let y = 3; y < 13; y += 2.8) {
        block(scene, frames, side * 3.95, y, panel, .12, 1.38, 1.75);
        const shade = glass[Math.floor(random() * glass.length)];
        block(scene, shade, side * 3.88, y, panel, .05, 1.04, 1.45);
        block(scene, frames, side * 3.84, y, panel, .05, 1.08, .065);
        block(scene, frames, side * 3.84, y + .12, panel, .05, .06, 1.45);
      }
    }
  }

  for (const side of [-1, 1]) {
    let near = 7.5;
    for (const branch of branches.filter((branch) => branch.side === side)) {
      facade(side, near, branch.z + halfOpening);
      near = branch.z - halfOpening;
      wall(side * 9, 5, branch.z, 1, 10, 2 * halfOpening, end);
      wall(side * 5.5, 2.4, branch.z + 1.1, .62, 4.8, .95, end);
      block(scene, frames, side * 8.44, 1.45, branch.z, .12, 2.9, 1.65);
      block(scene, pipe, side * 6.25, 3.1, branch.z - 1.46, 4.3, .17, .18);
      block(scene, glow('#a698ff'), side * 6.3, 3.4, branch.z - 1.43, 1.65, .09, .13);
      const lamp = new THREE.PointLight('#8c87ff', 40, 13, 1.65);
      lamp.position.set(side * 6.5, 2.8, branch.z - 1);
      
    }
    facade(side, near, -49.5);
  }

  for (const [x, z, color, title, panel] of [
    [-3.91, -3, 0xff7838, 'РАЙОН', '#702c16'],
    [3.91, -17, 0x7869ff, 'СВЯЗЬ', '#2c195f'],
    [-3.91, -29, 0xf43b91, 'НОЧЬ', '#550d3b'],
    [3.91, -41, 0x29c4dd, 'ЦЕХ', '#104b62']
  ]) {
    const light = new THREE.PointLight(color, 24, 14, 1.65);
    light.position.set(x * .72, 2.5, z);
    scene.add(light);
    sign(scene, title, new THREE.Color(color).getStyle(), panel, x, 3.65, z, -Math.sign(x) * Math.PI / 2, 2.6);
    block(scene, glow(color), x * .98, 2.85, z, .08, .055, 1.8);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: .49, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const patches = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, 90);
    const transform = new THREE.Object3D();
    transform.rotation.x = -Math.PI / 2;
    for (let i = 0; i < patches.count; i++) {
      const shade = .22 + random() * .73;
      transform.scale.set(.08 + random() * .5, .02 + random() * .14, 1);
      transform.position.set(x * .52 + (random() - .5) * 2.1, .009, z + (random() - .5) * 7);
      transform.updateMatrix();
      patches.setMatrixAt(i, transform.matrix);
      patches.setColorAt(i, new THREE.Color(shade, shade, shade));
    }
    scene.add(patches);
  }

  for (let i = 0; i < 45; i++) {
    const x = (random() - .5) * 7.1;
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(.22 + random() * .55, 7), tar);
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.x = 1.7;
    puddle.position.set(x, .004, 4 - random() * 48);
    scene.add(puddle);
  }

  const bins = [
    { x: 2.25, z: -7 },
    { x: -2.3, z: -19 },
    { x: 2.3, z: -31 }
  ];
  for (const { x, z } of bins) {
    wall(x, .55, z, 2.18, 1.02, 1.12, green);
    wall(x, 1.075, z, 2.29, .13, 1.23, black);
    block(scene, rail, x, .94, z, 2.23, .14, 1.18);
    for (let i = -4; i <= 4; i++) block(scene, frames, x + i * .234, 1.15, z, .038, .038, 1.13);
    for (const edge of [-1, 1]) {
      block(scene, rail, x + edge * 1.05, .58, z + .57, .14, .75, .105);
      block(scene, black, x + edge * .78, .075, z + .39, .17, .15, .15);
    }
  }

  const ambushes = [
    ...bins.map(({ x, z }) => ({ kind: 'bin', x, z: z - 1.05, peekX: -Math.sign(x) * .48, peekZ: 0 })),
    ...branches.map(({ side, z }) => ({ kind: 'corner', x: side * 6.35, z: z + .96, peekX: 0, peekZ: -.98 }))
  ];

  wall(0, 5.5, -47, 8, 11, 1, tiled(concrete, 3, 4));
  block(scene, solid('#693b29'), 0, 1.38, -46.44, 2.12, 2.76, .13);
  const amber = glow('#ff8b46');
  block(scene, amber, 0, 2.79, -46.31, 2.2, .10, .10);
  for (const side of [-1, 1]) block(scene, amber, side * 1.06, 1.39, -46.31, .08, 2.75, .10);
  sign(scene, 'ВЫХОД', '#ffb772', '#442423', 0, 3.28, -46.40, 0, 1.8);
  const exitLight = new THREE.PointLight('#ff8744', 45, 13, 1.7);
  exitLight.position.set(0, 2.5, -44.8);
  
  const batches = new Map();
  for (const mesh of [...scene.children]) {
    if (mesh.geometry !== cube || Array.isArray(mesh.material)) continue;
    if (!batches.has(mesh.material)) batches.set(mesh.material, []);
    batches.get(mesh.material).push(mesh);
  }
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const batch = new THREE.InstancedMesh(cube, material, meshes.length);
    meshes.forEach((mesh,i) => {
      mesh.updateMatrixWorld(); batch.setMatrixAt(i,mesh.matrixWorld); mesh.removeFromParent();
    });
    scene.add(batch);
  }
  return { colliders, ambushes };
}
