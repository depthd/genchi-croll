import { patrol, animateCasualty } from './patrol.js';
import { clockface } from './clockface.js';
import { atmosphere } from './audio.js';
import { specialistKind, specialist, updateSpecial } from './specialists.js';
import { radio } from './radio.js';
import { steerBot } from './gen/segments.js';
import { dressing } from './gen/dressing.js';
import { skyline, weatherTime } from './gen/skin.js';
import { sequence } from './gen/sequencer.js';
import { advance } from './gen/physics.js';
import { stream } from './gen/stream.js';
import { route, drawMap } from './gen/route.js';
import { campaign, save, restartCampaign } from './campaign.js';
import { pipeline } from './render.js';
import { config, query } from './config.js';
import * as THREE from 'three';
import { block, glow, randomGenerator, solid } from './city.js';

const view = document.querySelector('#view');
const overlay = document.querySelector('#menu');
const title = document.querySelector('#title');
const message = document.querySelector('#message');
const start = document.querySelector('#start');
const hud = document.querySelector('#hud');
const timeReadout = document.querySelector('#time');
const drawClock = clockface(timeReadout);
const ammoReadout = document.querySelector('#ammo');
const damage = document.querySelector('#damage');
const sensitivityControl = document.querySelector('#sensitivity');
const sensitivityValue = document.querySelector('#sensitivity-value');
const sensitivityKey = 'genchi-mouse-sensitivity';
const originalSensitivity = 0.00235;
let sensitivity = Number(sensitivityControl.value);
try {
  const saved = localStorage.getItem(sensitivityKey);
  if (saved !== null) sensitivityControl.value = saved;
} catch {
  // Settings still work this session if storage is unavailable.
}

function readSensitivity() {
  sensitivity = Number(sensitivityControl.value);
  sensitivityValue.textContent = `${sensitivity}%`;
}

readSensitivity();
sensitivityControl.addEventListener('input', () => {
  readSensitivity();
  try {
    localStorage.setItem(sensitivityKey, sensitivityControl.value);
  } catch {
    // The active setting is already applied.
  }
});

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: false });
} catch {
  message.textContent = 'Для запуска нужен браузер с WebGL 2.';
  start.disabled = true;
  throw new Error('WebGL 2 is unavailable.');
}
renderer.domElement.setAttribute('aria-label', 'Вид от первого лица');
view.append(renderer.domElement);

const pixels = pipeline(
  renderer,
  [240, 270, 360].includes(Number(query.get('res'))) ? Number(query.get('res')) : config.resolution,
);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0f24');
scene.fog = new THREE.FogExp2('#0a0f24', 0.034);
scene.add(new THREE.HemisphereLight('#a7bdf5', '#766563', 2));
const moon = new THREE.DirectionalLight('#8994dd', 0.65);
moon.position.set(-5, 14, 8);
scene.add(moon);

const camera = new THREE.PerspectiveCamera(67, 1, 0.035, 100);
camera.rotation.order = 'YXZ';
scene.add(camera);
const plan = route(campaign.seed),
  segments = sequence(plan);
const world = stream(scene, plan, segments, query.get('gen') === 'debug' ? null : dressing(plan));
const positionTower = skyline(scene, plan);
const colliders = world.colliders;
let distance = 0,
  botIndex = 0,
  botLayer = 'G',
  stuck = 0;
const body = { x: 0, y: 0, z: 0, vy: 0, grace: 0 };
let grace = 0,
  jumpQueue = 0,
  vx = 0,
  vz = 0,
  inserted = 0,
  reloadPhase = '';
const darkSteel = solid('#1d2447');
const silver = solid('#8e8990');
const charcoal = solid('#6b3e22');
const amber = glow('#ffac46');
const burst = glow('#ffbe65');
const weapon = new THREE.Group();
camera.add(weapon);
weapon.scale.setScalar(0.88);
block(weapon, charcoal, 0.035, -0.062, 0.009, 0.09, 0.15, 0.1).rotation.x = -0.32;
block(weapon, darkSteel, 0, 0, -0.1, 0.102, 0.08, 0.276);
block(weapon, charcoal, 0.012, -0.053, 0.005, 0.087, 0.14, 0.085).rotation.x = -0.28;
block(weapon, silver, 0, 0.063, -0.195, 0.058, 0.042, 0.27);
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.34, 8), silver);
barrel.rotation.x = Math.PI / 2;
barrel.position.set(0, 0.06, -0.26);
weapon.add(barrel);
const bore = new THREE.Mesh(new THREE.CircleGeometry(0.022, 8), darkSteel);
bore.rotation.y = Math.PI;
bore.position.set(0, 0.06, -0.431);
weapon.add(bore);
block(weapon, darkSteel, 0, 0.088, -0.33, 0.076, 0.046, 0.055);
block(weapon, amber, 0, 0.114, -0.336, 0.024, 0.012, 0.018);
block(weapon, charcoal, 0, 0.061, -0.336, 0.04, 0.034, 0.014);
const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.063, 0.095, 6), darkSteel);
cylinder.rotation.x = Math.PI / 2;
cylinder.position.set(0, 0.016, -0.089);
weapon.add(cylinder);
const barrelMaterial = solid('#7c828f'),
  recess = solid('#282a32');
for (const side of [-1, 1]) {
  block(weapon, barrelMaterial, side * 0.055, 0.028, -0.17, 0.019, 0.03, 0.21);
  block(weapon, recess, side * 0.052, 0.063, -0.21, 0.008, 0.018, 0.16);
  block(weapon, barrelMaterial, side * 0.063, 0.012, -0.08, 0.015, 0.033, 0.091);
}
block(weapon, recess, 0, 0.085, -0.12, 0.077, 0.025, 0.064);
block(weapon, barrelMaterial, 0, 0.091, -0.058, 0.036, 0.054, 0.035).rotation.x = -0.44;
block(weapon, barrelMaterial, 0, -0.074, -0.08, 0.023, 0.025, 0.11);
block(weapon, barrelMaterial, 0, -0.047, -0.133, 0.021, 0.063, 0.02);
block(weapon, recess, 0, -0.04, -0.1, 0.018, 0.04, 0.018);

for (let i = 0; i < 3; i++)
  block(weapon, silver, -0.025, -0.048 - 0.025 * i, 0.035 + 0.013 * i, 0.063, 0.025, 0.062);
for (let i = 0; i < 3; i++) {
  block(weapon, darkSteel, 0.04 + i * 0.024, -0.13 - i * 0.012, 0.078 + i * 0.054, 0.105, 0.08, 0.07);
  block(weapon, silver, 0.04 + i * 0.024, -0.11 - i * 0.012, 0.078 + i * 0.054, 0.086, 0.028, 0.056);
}
const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), burst);
flash.position.set(0, 0.069, -0.44);
flash.scale.set(0.9, 0.65, 1.48);
flash.visible = false;
weapon.add(flash);

const random = randomGenerator(740);
const rainCount = 820;
const rainPoints = new Float32Array(rainCount * 6);
for (let i = 0; i < rainPoints.length; i += 6) {
  rainPoints[i] = (random() - 0.5) * 16;
  rainPoints[i + 1] = random() * 14;
  rainPoints[i + 2] = -random() * 63 + 10;
}
const rainGeometry = new THREE.BufferGeometry();
rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPoints, 3));
const rain = new THREE.LineSegments(
  rainGeometry,
  new THREE.LineBasicMaterial({
    color: '#a6b6ee',
    transparent: true,
    opacity: 0.31,
    depthWrite: false,
  }),
);
rain.frustumCulled = false;
scene.add(rain);

const enemies = [],
  defeated = new Set();
function createEnemy(slot, segment) {
  return patrol(scene, slot, segment, slot.kind === 'corner');
}
function removeEnemy(enemy) {
  enemy.group.removeFromParent();
  enemy.badge?.map.dispose();
  for (const material of enemy.resources ?? []) material.dispose();
  enemy.group.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
  });
}
function syncEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (world.active.has(e.segment)) continue;
    removeEnemy(e);
    enemies.splice(i, 1);
  }
  for (const index of world.active.keys()) {
    if (enemies.some((e) => e.segment === index) || defeated.has(index)) continue;
    const seg = segments[index];
    const special = specialistKind(index, segments.length);
    if (special) {
      enemies.push(specialist(scene, special, seg));
      continue;
    }
    if (index === 0 || (index % 3 === 0 && index < segments.length / 2)) continue;
    enemies.push(
      createEnemy({ ...seg.enemy, kind: seg.threat >= 3 && index > 6 ? 'corner' : 'bin' }, index),
    );
  }
}

const keys = new Set();
const ray = new THREE.Raycaster();
const aimRay = new THREE.Raycaster();
const from = new THREE.Vector3();
const to = new THREE.Vector3();
const direction = new THREE.Vector3();
const effects = [];
const flashMaterial = new THREE.LineBasicMaterial({ color: '#ffcf82' });
const hostileMaterial = new THREE.LineBasicMaterial({ color: '#ff5a4e' });
const impactMaterial = new THREE.LineBasicMaterial({ color: '#4fe7ff' });
let audio,
  mixBus,
  armed = true,
  nextStep = 0,
  nextTick = 0;
const volume = document.querySelector('#volume');
try {
  volume.value = localStorage.getItem('genchi-volume') ?? 65;
} catch {}
function setVolume() {
  document.querySelector('#volume-value').value = volume.value + '%';
  mixBus?.volume(volume.value / 100);
}
volume.oninput = () => {
  setVolume();
  try {
    localStorage.setItem('genchi-volume', volume.value);
  } catch {}
};
setVolume();
const dispatch = radio(() => sound('empty'));
let state = 'intro';
let seconds = config.startTime,
  bodySpeed = 0,
  transfer = 0;
const bodyId = document.querySelector('#body-id'),
  progress = document.querySelector('#progress'),
  delta = document.querySelector('#delta');
document.querySelector('#new-campaign').onclick = restartCampaign;
let runTime = 0;
let ammo = 6;
let yaw = 0;
let pitch = 0;
let recoil = 0;
let cooldown = 0;
let reloadTime = 0;
let hurt = 0;
let hitMark = 0;
let lastFrame = performance.now();

function sound(type) {
  if (!audio || audio.state !== 'running') return;
  const now = audio.currentTime;
  const duration = { fire: 0.23, enemy: 0.14, reload: 0.11, empty: 0.045 }[type];
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  tone.type = type === 'fire' ? 'sawtooth' : 'triangle';
  tone.frequency.setValueAtTime({ fire: 160, enemy: 300, reload: 950, empty: 530 }[type], now);
  tone.frequency.exponentialRampToValueAtTime(type === 'fire' ? 34 : 89, now + duration);
  volume.gain.setValueAtTime(type === 'fire' ? 0.19 : 0.064, now);
  volume.gain.exponentialRampToValueAtTime(0.001, now + duration);
  tone.connect(volume).connect(mixBus?.input ?? audio.destination);
  if (type === 'fire') mixBus?.shot();
  tone.start(now);
  tone.stop(now + duration);
}

function trail(startPoint, endPoint, material, lifetime) {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]),
    material,
  );
  scene.add(line);
  effects.push({ line, remaining: lifetime });
}

function sparks(point, colorMaterial) {
  for (let i = 0; i < 7; i++) {
    const end = point
      .clone()
      .add(new THREE.Vector3((random() - 0.5) * 0.62, random() * 0.43, (random() - 0.5) * 0.55));
    trail(point, end, colorMaterial, 0.09 + random() * 0.08);
  }
}

function menu(next, heading, copy, label) {
  state = next;
  title.textContent = heading;
  message.textContent = copy;
  start.firstChild.textContent = label + ' ';
  overlay.hidden = false;
  hud.hidden = true;
  document.body.classList.remove('playing');
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
}

function reset() {
  const shots = [1, 3, 6, 0, 2, segments.length - 1];
  const named = {
    start: 0,
    alley: 1,
    fork: 6,
    upper: 6,
    shortcut: 3,
    block: 9,
    yard: segments.length - 1,
  };
  const at = query.get('at') || '';
  const relay = Number(query.get('relay')) || campaign.relay;
  const i = Math.min(
    segments.length - 1,
    Math.max(
      0,
      Number(
        at.match(/^seg(\d+)$/)?.[1] ??
          named[at] ??
          shots[Number(query.get('shot')) - 1] ??
          plan.relays[relay - 1] ??
          0,
      ),
    ),
  );
  const layer =
    query.get('layer') ||
    (at === 'upper' ? 'R' : at === 'shortcut' || query.get('shot') === '2' ? 'I' : 'G');
  const firstWake =
    i === 0 && campaign.attempts === 0 && !query.has('shot') && !query.has('bots') && !query.has('at');
  const port = segments[i].entry[firstWake ? 'I' : layer] || segments[i].entry.G,
    c = plan.cells[i];
  botIndex = i;
  botLayer = layer in config.layers ? layer : 'G';
  world.sync(i);
  Object.assign(body, {
    botSegment: null,
    waypoint: 1,
    ride: null,
    lastDevice: null,
    x: port.x + c.dx * 0.3,
    y: port.y,
    z: port.z + c.dz * 0.3,
    vy: 0,
    grace: config.jumpBuffer,
  });
  camera.position.set(body.x, body.y + config.eye, body.z);
  distance = i;
  jumpQueue = vx = vz = 0;
  grace = config.jumpBuffer;
  reloadPhase = '';
  yaw = Math.atan2(-c.dx, -c.dz);
  pitch = 0;
  camera.rotation.set(0, yaw, 0, 'YXZ');
  const chassis =
    campaign.attempts === 0
      ? 0
      : Math.floor(randomGenerator(campaign.seed ^ Math.imul(campaign.attempts, 2654435761))() * 3);
  seconds = config.startTime + config.bodyTimes[chassis];
  bodySpeed = config.bodySpeeds[chassis];
  bodyId.textContent =
    'ТЕЛО №' + (campaign.attempts + 1) + ' · ' + ['Обычный', 'Лёгкий', 'Прочный'][chassis];
  dispatch.reset();
  armed = campaign.attempts > 0 || i > 0 || query.has('shot') || query.has('bots');
  weapon.visible = armed;
  if (query.get('shot') === '4') {
    camera.position.set(7.5, 1.58, -1.7);
    camera.lookAt(12.3, 1.25, -6);
    weapon.visible = false;
  }
  if (query.get('shot') === '6') {
    camera.position.set(port.x + c.dx * 12, 1.6, port.z + c.dz * 12);
    camera.lookAt(port.x + c.dx * 32, 7.8, port.z + c.dz * 32);
  }
  if (query.has('shot') && query.get('shot') !== '5') weapon.visible = false;
  delta.textContent = '';
  combatReadout.textContent = '';
  runTime = 0;
  nextStep = nextTick = 0;
  ammo = 6;
  cooldown = recoil = reloadTime = hurt = hitMark = 0;
  for (const e of enemies.splice(0)) removeEnemy(e);
  defeated.clear();
  syncEnemies();
  if (query.get('shot') === '5') {
    const target = enemies.find((e) => e.segment === i);
    if (target) {
      target.group.position.set(target.x + target.peekX, 0, target.z + target.peekZ);
      target.group.rotation.y = Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
      camera.position.lerp(target.group.position, 0.78);
      camera.position.y = 1.55;
      camera.lookAt(target.group.position.clone().add(new THREE.Vector3(0, 1.25, 0)));
    }
  }
  for (const b of bullets.splice(0)) b.mesh.removeFromParent();
  for (const { line } of effects.splice(0)) {
    line.removeFromParent();
    line.geometry.dispose();
  }
}

function enter() {
  if (state === 'playing') return;
  if (state !== 'paused') {
    if (state === 'won') campaign.relay = 0;
    reset();
    campaign.attempts++;
    save();
  }
  state = 'playing';
  overlay.hidden = true;
  hud.hidden = false;
  document.body.classList.add('playing');
  const context = window.AudioContext ?? window.webkitAudioContext;
  if (context) {
    audio ??= new context();
    mixBus ??= atmosphere(audio, volume.value / 100);
    void audio.resume().catch(() => {});
  }
  try {
    const lock = renderer.domElement.requestPointerLock?.();
    lock?.catch(() => {});
  } catch {
    // Arrow keys still allow aiming if the browser refuses pointer lock.
  }
}

function hasCover(origin, target) {
  direction.subVectors(target, origin);
  ray.set(origin, direction.clone().normalize());
  ray.far = direction.length() - 0.03;
  return ray.intersectObjects(colliders, false).length > 0;
}

const combatReadout = document.createElement('output');
combatReadout.id = 'combat-readout';
document.body.append(combatReadout);
let feedbackUntil = 0;
function combatFeedback(text, color = '#b9ab8c') {
  combatReadout.textContent = text;
  combatReadout.style.color = color;
  feedbackUntil = runTime + 1.15;
}
const shotLight = new THREE.PointLight('#ffb66b', 0, 8, 2);
camera.add(shotLight);
shotLight.position.set(0.2, -0.1, -0.8);
function shoot() {
  if (state !== 'playing' || cooldown || (reloadTime && !inserted)) return;
  reloadTime = 0;
  reloadPhase = '';
  inserted = 0;
  if (!ammo) {
    sound('empty');
    cooldown = 0.2;
    return;
  }
  if (!armed) return;
  dispatch.say('fire', runTime);
  ammo--;
  cooldown = config.fireDelay;
  recoil = 1;
  sound('fire');
  shotLight.intensity = 12;
  for (const guard of enemies)
    if (
      !guard.kind &&
      guard.health > 0 &&
      camera.position.distanceTo(guard.group.position) <= config.gunshotRadius
    )
      guard.alert ??= runTime;
  const spread = THREE.MathUtils.degToRad(
    grace <= 0 ? 3 : Math.hypot(vx, vz) > 6.2 ? 2.5 : Math.hypot(vx, vz) > 0.1 ? 1.2 : 0.2,
  );
  aimRay.setFromCamera(new THREE.Vector2((random() - 0.5) * spread, (random() - 0.5) * spread), camera);
  cylinder.rotation.y += Math.PI / 3;
  aimRay.far = 65;
  scene.updateMatrixWorld(true);
  const targets = enemies
    .filter((enemy) => enemy.health > 0)
    .flatMap(({ head, chest, shield }) => (shield ? [head, chest, shield] : [head, chest]));
  const hit = aimRay.intersectObjects([...colliders, ...targets], false)[0];
  const end = hit?.point ?? aimRay.ray.at(50, new THREE.Vector3());
  flash.getWorldPosition(from);
  trail(from, end, flashMaterial, 0.055);
  if (!hit) {
    combatFeedback('МИМО', '#6e7a8b');
    return;
  }
  const enemy = enemies.find(
    ({ head, chest, shield }) => hit.object === head || hit.object === chest || hit.object === shield,
  );
  if (enemy && hit.object === enemy.shield) {
    combatFeedback('ЩИТ · ОБОЙДИ СБОКУ', '#ff9a3c');
    sparks(end, flashMaterial);
    return;
  }
  if (enemy) {
    if (enemy.shield) {
      const angle = Math.atan2(
        camera.position.x - enemy.group.position.x,
        camera.position.z - enemy.group.position.z,
      );
      if (Math.cos(angle - enemy.group.rotation.y) > 0.55) {
        combatFeedback('БРОНЯ · ОБОЙДИ СБОКУ', '#ff9a3c');
        sparks(end, flashMaterial);
        return;
      }
    }
    enemy.health -= hit.object === enemy.head ? (enemy.kind === 'runner' ? 2 : 3) : 1;
    enemy.hitUntil = runTime + 0.13;
    enemy.alert ??= runTime;
    mixBus?.hit?.();
    combatFeedback(
      hit.object === enemy.head
        ? 'В ГОЛОВУ'
        : 'ПОПАДАНИЕ · ' + Math.max(0, enemy.health) + '/' + (enemy.maxHealth ?? 3),
      enemy.health <= 0 ? '#7dff1a' : '#4fe7ff',
    );
    if (enemy.health <= 0) {
      enemy.deadAt = runTime;
      defeated.add(enemy.segment);
      dispatch.say('kill', runTime);
      const bonus = hit.object === enemy.head ? config.headBonus : config.killBonus;
      seconds = Math.min(config.cap, seconds + bonus);
      delta.textContent = '+' + bonus.toFixed(1) + ' с';
      combatFeedback(
        (hit.object === enemy.head ? 'В ГОЛОВУ' : 'ЦЕЛЬ ОТКЛЮЧЕНА') + ' · +' + bonus.toFixed(1) + ' с',
        '#7dff1a',
      );
    }
    hitMark = 0.16;
    enemy.alert ??= runTime;
  }
  if (!enemy) combatFeedback('УКРЫТИЕ', '#8b96a3');
  sparks(end, enemy ? impactMaterial : flashMaterial);
}

function move(dt) {
  if (keys.has('ArrowLeft')) yaw += dt * 1.75;
  if (keys.has('ArrowRight')) yaw -= dt * 1.75;
  if (keys.has('ArrowUp')) pitch += dt * 1.25;
  if (keys.has('ArrowDown')) pitch -= dt * 1.25;
  pitch = THREE.MathUtils.clamp(pitch, -1.3, 1.3);
  const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const ahead = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const stride =
    ((sprint ? config.sprint : config.walk) + bodySpeed) / Math.max(1, Math.hypot(strafe, ahead));
  const blend = Math.min(1, dt * 24 * (grace > 0 ? 1 : config.airControl));
  vx += ((Math.cos(yaw) * strafe - Math.sin(yaw) * ahead) * stride - vx) * blend;
  vz += ((-Math.sin(yaw) * strafe - Math.cos(yaw) * ahead) * stride - vz) * blend;
  const pos = camera.position;
  if (query.get('bots') === '1') {
    const cmd = steerBot(body, segments[botIndex], botLayer, dt);
    if (cmd.arrived && botIndex < segments.length - 1) botIndex++;
    if (!cmd.arrived) yaw = Math.atan2(-cmd.dx, -cmd.dz);
    const ox = body.x,
      oz = body.z;
    advance(body, world.near, cmd.dx, cmd.dz, dt, cmd.jump);
    stuck = !cmd.arrived && Math.hypot(body.x - ox, body.z - oz) < 0.0001 ? stuck + dt : 0;
    if (stuck > 1) {
      console.warn('Застревание', plan.seed, botIndex, botLayer);
      stuck = 0;
    }
  } else advance(body, world.near, vx * dt, vz * dt, dt, jumpQueue > 0);
  if (body.vy > 0) jumpQueue = 0;
  jumpQueue = Math.max(0, jumpQueue - dt);
  grace = body.grace;
  pos.set(body.x, body.y + config.eye, body.z);
  const previous = world.index;
  distance = world.locate(pos);
  if (previous !== world.index) syncEnemies();
  const relay = plan.relays.indexOf(world.index) + 1;
  if (relay > campaign.relay && Math.abs(distance - world.index) < 0.4) {
    campaign.relay = relay;
    save();
    seconds = Math.min(config.cap, seconds + config.relayBonus);
    delta.textContent = 'Ретранслятор · +30';
    sound('reload');
  }
  if (body.y < -12) seconds = 0;
  const fov = 67 + (sprint && ahead ? 6 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 9);
    camera.updateProjectionMatrix();
  }
  camera.rotation.set(pitch + recoil * 0.023, yaw, 0, 'YXZ');
}

const bullets = [];
function fireRound(origin, target, damage) {
  const mesh = block(scene, burst, origin.x, origin.y, origin.z, 0.045, 0.045, 0.48);
  mesh.lookAt(target);
  bullets.push({ mesh, dir: target.clone().sub(origin).normalize(), range: 40, damage });
}
function takeDamage(amount) {
  if (query.get('god') !== '1') seconds -= amount;
  delta.textContent = '−' + amount.toFixed(1);
  hurt = 0.8;
  combatFeedback('ПОПАДАНИЕ ПО КОРПУСУ · −' + amount.toFixed(1) + ' с', '#ff9a3c');
}
function projectiles(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i],
      step = Math.min(b.range, dt * config.bulletSpeed);
    const previous = b.mesh.position;
    ray.set(previous, b.dir);
    ray.far = step;
    let stopped = ray.intersectObjects(colliders, false).length > 0;
    const next = to.copy(previous).addScaledVector(b.dir, step);
    if (!stopped) {
      const closest = new THREE.Line3(previous, next).closestPointToPoint(camera.position, true, from);
      if (closest.distanceTo(camera.position) < 0.42) {
        takeDamage(b.damage);
        stopped = true;
      }
    }
    previous.copy(next);
    b.range -= step;
    if (stopped || b.range <= 0) {
      b.mesh.removeFromParent();
      bullets.splice(i, 1);
    }
  }
}
function updateEnemies(dt) {
  for (const enemy of enemies) {
    if (enemy.health <= 0) {
      if (enemy.deadAt !== null) animateCasualty(enemy, runTime);
      continue;
    }
    if (enemy.kind) {
      updateSpecial(
        enemy,
        camera,
        segments[enemy.segment],
        runTime,
        dt,
        hasCover,
        fireRound,
        takeDamage,
        () => sound('empty'),
      );
      continue;
    }
    const { group, standing } = enemy;
    group.rotation.y = Math.atan2(
      camera.position.x - group.position.x,
      camera.position.z - group.position.z,
    );
    if (
      enemy.alert === null &&
      runTime >= (enemy.nextSight ?? 0) &&
      camera.position.distanceTo(group.position) < 19
    ) {
      enemy.nextSight = runTime + config.sightInterval;
      to.set(enemy.x + enemy.peekX, 1.6, enemy.z + enemy.peekZ);
      if (!hasCover(camera.position, to)) enemy.alert = runTime;
    }
    const age = enemy.alert === null ? -1 : runTime - enemy.alert;
    const cycle = Math.floor(age / 3.1);
    const phase = age % 3.1;
    const exposure =
      age < 0
        ? 0
        : THREE.MathUtils.smoothstep(phase, 0.56, 0.91) *
          (1 - THREE.MathUtils.smoothstep(phase, 1.96, 2.28));
    const blend = Math.min(1, 21 * dt);
    group.position.x = THREE.MathUtils.lerp(group.position.x, enemy.x + exposure * enemy.peekX, blend);
    group.position.z = THREE.MathUtils.lerp(group.position.z, enemy.z + exposure * enemy.peekZ, blend);
    if (!standing) {
      group.position.y = THREE.MathUtils.lerp(group.position.y, -0.44 + exposure * 0.44, blend);
    }
    if (enemy.armor) {
      enemy.armor.color
        .set(enemy.hitUntil > runTime ? '#4fe7ff' : '#b9ab8c')
        .multiplyScalar(enemy.hitUntil > runTime ? 2.5 : 2);
    }
    enemy.visor.scale.setScalar(phase > 0.88 && phase < 1.33 ? 1.55 : 1);
    enemy.muzzle.visible = false;
    const shot = Math.min(enemy.rifle ? 2 : 0, Math.floor((phase - 1.33) / 0.14));
    if (age >= 0 && phase > 0.91 && phase < 1.33) {
      enemy.visor.material.color.set('#9bdfff');
      if (enemy.warned !== cycle) {
        sound('empty');
        enemy.warned = cycle;
      }
    }
    if (phase < 1.33 || phase > 1.94 || enemy.cycle === cycle * 3 + shot) continue;
    enemy.muzzle.getWorldPosition(from);
    to.copy(camera.position);
    if (hasCover(from, to)) continue;
    enemy.cycle = cycle * 3 + shot;
    enemy.muzzle.visible = true;
    fireRound(from, to, enemy.rifle ? config.damage.rifle : config.damage.patrol);
    sound('enemy');
  }
}

function update(dt) {
  runTime += dt;
  if (armed && query.get('god') !== '1') seconds -= dt;
  cooldown = Math.max(0, cooldown - dt);
  recoil = Math.max(0, recoil - 7 * dt);
  hurt = Math.max(0, hurt - 2.5 * dt);
  hitMark = Math.max(0, hitMark - dt);
  if (reloadTime > 0) {
    reloadTime -= dt;
    if (reloadTime <= 0) {
      reloadTime = 0;
      if (reloadPhase === 'open') {
        reloadPhase = 'round';
        reloadTime = config.reloadRound;
      } else if (reloadPhase === 'round') {
        ammo++;
        inserted++;
        sound('reload');
        if (ammo === 6) {
          reloadPhase = 'close';
          reloadTime = config.reloadClose;
        } else reloadTime = config.reloadRound;
      } else {
        reloadPhase = '';
        inserted = 0;
      }
    }
  }
  move(dt);
  if (!armed && (distance > 0.08 || body.y < -0.6)) {
    armed = weapon.visible = true;
    dispatch.say('start', runTime);
  }
  if (armed) {
    updateEnemies(dt);
    projectiles(dt);
  }
  if (distance > 5) dispatch.say('fork', runTime);
  if (body.y > 7) dispatch.say('roof', runTime);
  if (body.y > 2 && body.y < 4) dispatch.say('room', runTime);
  if (seconds < 15) dispatch.say('low', runTime);
  dispatch.update(runTime);
  if (mixBus && runTime >= nextTick) {
    mixBus.tick();
    nextTick = runTime + (seconds < 15 ? 0.35 : 1);
    mixBus.ambience(body.y < 0);
  }
  if (mixBus && runTime >= nextStep && grace > 0 && Math.hypot(vx, vz) > 0.7) {
    mixBus.step(body.y);
    nextStep = runTime + 0.32;
  }
  const clock = Math.max(0, seconds);
  drawClock(clock);
  progress.value = Math.min(1, Math.max(0, distance / segments.length));
  campaign.record = Math.max(campaign.record, progress.value);
  document.querySelector('#record').style.right = 14 * (1 - campaign.record) + 4 + 'vw';
  ammoReadout.textContent = '●'.repeat(ammo) + '○'.repeat(6 - ammo);
  ammoReadout.setAttribute('aria-label', reloadTime ? 'Перезарядка' : `Патроны: ${ammo} из 6`);
  damage.style.opacity = String(hurt);
  const crosshair = document.querySelector('#crosshair');
  crosshair.textContent = hitMark > 0 ? '×' : '+';
  crosshair.style.color = hitMark > 0 ? '#4fe7ff' : '#b9ab8c';
  crosshair.style.fontSize = 16 + recoil * 10 + 'px';
  if (runTime > feedbackUntil) combatReadout.textContent = '';
  if (seconds <= 0) {
    dispatch.say('death', runTime);
    mixBus?.transfer();
    state = 'transfer';
    transfer = 0;
    save();
    keys.clear();
    title.textContent = 'Тело №' + campaign.attempts + ' деактивировано';
    message.textContent =
      'Сознание переносится… Ближе всех подобрался: ' + Math.round(100 * campaign.record) + '%';
  } else if (distance > segments.length - 0.035) {
    dispatch.say('end', runTime);
    campaign.best = campaign.best === null ? runTime : Math.min(runTime, campaign.best);
    save();
    menu(
      'won',
      'Сектор 02 — скоро',
      `Тело №${campaign.attempts} · время ${runTime.toFixed(1)} с · до деактивации ${seconds.toFixed(1)} с.`,
      'Ещё раз',
    );
  }
}

function resize() {
  camera.aspect = 16 / 9;
  camera.updateProjectionMatrix();
}

let transferClock = performance.now();
function frame(now) {
  const elapsed = Math.max(0.001, (now - lastFrame) / 1000);
  const dt = Math.min(0.045, elapsed);
  lastFrame = now;
  if (state === 'playing') {
    let remaining = Math.min(0.25, elapsed);
    while (remaining > 0.000001 && state === 'playing') {
      const step = Math.min(1 / 60, remaining);
      update(step);
      remaining -= step;
    }
  } else if (state === 'transfer') {
    transfer += Math.max(0, (now - transferClock) / 1000);
    damage.style.opacity = String(Math.min(1, transfer));
    if (transfer >= config.transferFreeze) {
      overlay.hidden = false;
      overlay.classList.add('transfer');
      hud.hidden = true;
    }
    if (transfer >= config.transferSeconds) {
      overlay.classList.remove('transfer');
      enter();
    }
  } else damage.style.opacity = '0';
  transferClock = now;
  const bob =
    state === 'playing' ? Math.sin(runTime * 12) * Math.min(0.003, Math.hypot(vx, vz) * 0.0005) : 0;
  weapon.position.set(
    0.205,
    -0.199 + bob + recoil * 0.04 - (reloadTime ? 0.115 : 0),
    -0.44 + recoil * 0.055,
  );
  weapon.rotation.set(0.06 + recoil * 0.24, 0.16, reloadTime ? -0.48 : -0.04);
  cylinder.position.x = reloadTime ? -0.095 : 0;
  const cell = plan.cells[world.index];
  const side = (camera.position.x - cell.x) * -cell.dz + (camera.position.z - cell.z) * cell.dx;
  rain.visible = camera.position.y >= 0 && !(side > 4.5 && side < 14.5 && camera.position.y < 4.8);
  flash.visible = recoil > 0.66;
  shotLight.intensity = recoil > 0.66 ? 12 : 0;
  for (let i = 0; i < rainPoints.length; i += 6) {
    rainPoints[i + 1] -= dt * (10 + (i % 11) * 0.4);
    if (rainPoints[i + 1] < -0.25) rainPoints[i + 1] += 14;
    rainPoints[i + 3] = rainPoints[i] + 0.042;
    rainPoints[i + 4] = rainPoints[i + 1] + 0.32;
    rainPoints[i + 5] = rainPoints[i + 2] + 0.025;
  }
  rainGeometry.attributes.position.needsUpdate = true;
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    effect.remaining -= dt;
    if (effect.remaining > 0) continue;
    effect.line.removeFromParent();
    effect.line.geometry.dispose();
    effects.splice(i, 1);
  }
  if (map.isConnected) drawMap(map, plan, camera.position, segments);
  rain.position.copy(camera.position);
  rain.rotation.y = yaw;
  world.openNear(camera.position);
  weatherTime.value = now * 0.001;
  positionTower(camera.position);
  pixels.render(scene, camera);
  if (stats.isConnected && now - (stats.last || 0) > 500) {
    stats.textContent =
      Math.round(1 / elapsed) +
      ' кадр/с · вызовы ' +
      renderer.info.render.calls +
      ' · треуг. ' +
      renderer.info.render.triangles +
      ' · враги ' +
      enemies.length;
    stats.last = now;
  }
  requestAnimationFrame(frame);
}

start.addEventListener('click', enter);
window.addEventListener('resize', resize);
window.addEventListener('blur', () => {
  keys.clear();
  if (state === 'playing') menu('paused', 'Пауза', 'Таймер остановлен.', 'Продолжить');
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing')
    menu('paused', 'Пауза', 'Таймер остановлен.', 'Продолжить');
});
document.addEventListener('keydown', (event) => {
  if (state !== 'playing') return;
  if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  keys.add(event.code);
  if (event.code === 'KeyR' && ammo < 6 && reloadTime === 0) {
    reloadTime = config.reloadOpen;
    reloadPhase = 'open';
    inserted = 0;
    sound('reload');
  }
  if (event.code === 'Escape' && !document.pointerLockElement)
    menu('paused', 'Пауза', 'Таймер остановлен.', 'Продолжить');
  if (event.code === 'Space' && !event.repeat) jumpQueue = config.jumpBuffer;
});
document.addEventListener('keyup', (event) => keys.delete(event.code));
document.addEventListener('mousemove', (event) => {
  if (state !== 'playing' || document.pointerLockElement !== renderer.domElement) return;
  const scale = (originalSensitivity * sensitivity) / 100;
  yaw -= event.movementX * scale;
  pitch -= event.movementY * scale;
});
renderer.domElement.addEventListener('mousedown', (event) => {
  if (event.button === 0) shoot();
});

const map = document.createElement('canvas');
if (query.get('gen') === 'debug') {
  map.id = 'gen-map';
  map.width = map.height = 420;
  document.body.append(map);
  drawMap(map, plan, camera.position);
}
const stats = document.createElement('output');
if (query.get('debug') === '1') {
  const panel = document.createElement('aside');
  panel.id = 'debug';
  panel.append(stats);
  for (const key of ['walk', 'sprint', 'fireDelay', 'startTime']) {
    const label = document.createElement('label');
    label.textContent = key;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '.1';
    input.value = config[key];
    input.onchange = () => {
      if (input.valueAsNumber > 0) config[key] = input.valueAsNumber;
    };
    label.append(input);
    panel.append(label);
  }
  document.body.append(panel);
}
window.GAME = {
  get ammo() {
    return ammo;
  },
  get armed() {
    return armed;
  },
  get reloadPhase() {
    return reloadPhase;
  },
  camera,
  enemies,
  config,
  plan,
  segments,
  world,
  body,
  renderer,
  campaign,
  get seconds() {
    return seconds;
  },
  get state() {
    return state;
  },
};
scene.traverse((o) => {
  if (o.material)
    for (const m of [].concat(o.material)) {
      if (!m.vertexColors) pixels.snap(m);
    }
});
reset();
if (query.get('bots') === '1') {
  state = 'playing';
  hud.hidden = false;
  overlay.hidden = true;
}
if (query.has('shot')) {
  overlay.hidden = true;
  document.body.classList.add('photo');
}
resize();
requestAnimationFrame(frame);
