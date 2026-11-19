import * as T from 'three';
import { block, glow, solid } from './city.js';
import { surface } from './surfaces.js';
export function patrol(scene, slot, segment, rifle) {
  const group = new T.Group();
  scene.add(group);
  const armor = surface('steel', segment % 3).clone();
  armor.color.set('#b9ab8c').multiplyScalar(2);
  const uniform = solid('#1d2447'),
    trim = solid('#b9ab8c'),
    dark = solid('#252c39');
  const optic = glow('#3a83ff'),
    spark = glow('#ffcb75');
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 32;
  labelCanvas.height = 16;
  const ink = labelCanvas.getContext('2d');
  ink.fillStyle = '#353b48';
  ink.fillRect(0, 0, 32, 16);
  ink.fillStyle = '#b9ab8c';
  ink.font = 'bold 11px monospace';
  ink.textAlign = 'center';
  ink.fillText('PDL', 16, 12);
  const badgeMap = new T.CanvasTexture(labelCanvas);
  badgeMap.minFilter = badgeMap.magFilter = T.NearestFilter;
  const badge = new T.MeshBasicMaterial({ map: badgeMap });
  const badgeMesh = new T.Mesh(new T.PlaneGeometry(0.27, 0.135), badge);
  badgeMesh.position.set(0, 1.13, 0.186);
  group.add(badgeMesh);
  const chest = block(group, armor, 0, 1.12, 0, 0.58, 0.52, 0.34);
  block(group, uniform, 0, 0.9, 0, 0.47, 0.18, 0.31);
  block(group, trim, 0, 1.25, 0.19, 0.32, 0.075, 0.05);
  for (const side of [-1, 1]) {
    block(group, uniform, side * 0.15, 0.57, 0, 0.22, 0.51, 0.24);
    block(group, armor, side * 0.15, 0.35, 0.05, 0.19, 0.17, 0.27);
    block(group, dark, side * 0.15, 0.1, 0.1, 0.24, 0.2, 0.39);
    block(group, armor, side * 0.34, 1.31, 0, 0.22, 0.24, 0.35);
    block(group, uniform, side * 0.34, 1.09, 0.11, 0.16, 0.3, 0.22).rotation.x = -0.45;
    block(group, trim, side * 0.3, 1.0, 0.27, 0.13, 0.14, 0.19);
  }
  const head = block(group, armor, 0, 1.63, 0, 0.35, 0.35, 0.34);
  block(group, dark, 0, 1.59, 0.18, 0.33, 0.16, 0.06);
  const visor = block(group, optic, 0, 1.67, 0.22, 0.3, 0.065, 0.035);
  block(group, armor, 0, 1.81, 0.06, 0.39, 0.07, 0.44);
  block(group, trim, 0.38, 1.4, 0.02, 0.08, 0.06, 0.27);
  const gun = new T.Group();
  gun.position.set(-0.2, 1.1, 0.34);
  group.add(gun);
  block(gun, dark, 0, 0, 0, 0.12, 0.13, rifle ? 0.55 : 0.28);
  block(gun, armor, 0, 0.055, 0.1, 0.09, 0.06, rifle ? 0.48 : 0.24);
  block(gun, dark, 0, -0.12, -0.05, 0.09, 0.18, 0.12);
  const muzzle = block(gun, spark, 0, 0.035, rifle ? 0.32 : 0.2, 0.16, 0.14, 0.21);
  muzzle.visible = false;
  group.updateMatrixWorld(true);
  const batches = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o === visor || o === muzzle || o === badgeMesh) return;
    if (!batches.has(o.material)) batches.set(o.material, []);
    batches.get(o.material).push(o);
  });
  for (const [material, parts] of batches) {
    const batch = new T.InstancedMesh(parts[0].geometry, material, parts.length);
    parts.forEach((part, i) => {
      batch.setMatrixAt(i, part.matrixWorld);
      part.visible = false;
    });
    group.add(batch);
  }
  group.position.set(slot.x, 0, slot.z);
  group.updateMatrixWorld(true);
  return {
    ...slot,
    segment,
    rifle,
    standing: rifle,
    group,
    head,
    chest,
    visor,
    muzzle,
    armor,
    gun,
    badge,
    resources: [armor, uniform, trim, dark, optic, spark, badge],
    health: rifle ? 3 : 2,
    maxHealth: rifle ? 3 : 2,
    alert: null,
    cycle: -1,
    hitUntil: 0,
    deadAt: null,
  };
}
export function animateCasualty(e, t) {
  const age = t - e.deadAt;
  e.group.rotation.x = (-Math.min(1, age / 0.42) * Math.PI) / 2;
  e.group.position.y = 0.08;
  if (age > 3) e.group.visible = false;
}
