import * as THREE from 'three';
import { block, buildCity, glow, randomGenerator, solid } from './city.js';

const view = document.querySelector('#view');
const overlay = document.querySelector('#menu');
const title = document.querySelector('#title');
const message = document.querySelector('#message');
const start = document.querySelector('#start');
const hud = document.querySelector('#hud');
const timeReadout = document.querySelector('#time');
const ammoReadout = document.querySelector('#ammo');
const damage = document.querySelector('#damage');
const sensitivityControl = document.querySelector('#sensitivity');
const sensitivityValue = document.querySelector('#sensitivity-value');
const sensitivityKey = 'genchi-mouse-sensitivity';
const originalSensitivity = .00235;
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

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1c223b');
scene.fog = new THREE.FogExp2('#1c223b', .043);
scene.add(new THREE.HemisphereLight('#a7bdf5', '#766563', 2));
const moon = new THREE.DirectionalLight('#8994dd', .65);
moon.position.set(-5, 14, 8);
scene.add(moon);

const camera = new THREE.PerspectiveCamera(67, 1, .035, 100);
camera.rotation.order = 'YXZ';
scene.add(camera);
const { colliders, covers } = buildCity(scene);
scene.updateMatrixWorld(true);
const walls = colliders.map((mesh) => new THREE.Box3().setFromObject(mesh));

const darkSteel = solid('#41424c');
const silver = solid('#8e8990');
const charcoal = solid('#2c2935');
const amber = glow('#ffac46');
const optic = glow('#ff344a');
const burst = glow('#ffbe65');
const weapon = new THREE.Group();
camera.add(weapon);
block(weapon, silver, .035, -.062, .009, .106, .175, .12).rotation.x = -.32;
block(weapon, charcoal, 0, 0, -.10, .102, .08, .276);
block(weapon, silver, 0, .063, -.195, .085, .067, .27);
block(weapon, darkSteel, 0, .088, -.33, .076, .046, .055);
block(weapon, amber, 0, .114, -.336, .024, .012, .018);
block(weapon, charcoal, 0, .061, -.336, .04, .034, .014);
const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(.063, .063, .095, 6), darkSteel);
cylinder.rotation.x = Math.PI / 2;
cylinder.position.set(0, .016, -.089);
weapon.add(cylinder);
for (let i = 0; i < 3; i++) block(weapon, silver, -.025, -.048 - .025 * i, .035 + .013 * i, .063, .025, .062);
const flash = new THREE.Mesh(new THREE.OctahedronGeometry(.13), burst);
flash.position.set(0, .069, -.44);
flash.scale.set(.9, .65, 1.48);
flash.visible = false;
weapon.add(flash);

const random = randomGenerator(740);
const rainCount = 760;
const rainPoints = new Float32Array(rainCount * 6);
for (let i = 0; i < rainPoints.length; i += 6) {
  rainPoints[i] = (random() - .5) * 16;
  rainPoints[i + 1] = random() * 14;
  rainPoints[i + 2] = -random() * 63 + 10;
}
const rainGeometry = new THREE.BufferGeometry();
rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPoints, 3));
const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({
  color: '#a6b6ee', transparent: true, opacity: .31, depthWrite: false
}));
rain.frustumCulled = false;
scene.add(rain);

const enemies = covers.map(({ x, z, side }, i) => {
  const group = new THREE.Group();
  scene.add(group);
  const head = block(group, silver, 0, .27, 0, .31, .29, .28);
  const chest = block(group, darkSteel, 0, -.055, -.02, .52, .32, .34);
  block(group, optic, 0, .30, .147, .23, .047, .024);
  block(group, charcoal, 0, .025, .164, .19, .13, .07);
  for (const side of [-1, 1]) {
    block(group, silver, side * .3, -.035, .015, .15, .21, .20);
    block(group, darkSteel, side * .31, -.15, .12, .125, .12, .31);
    block(group, darkSteel, side * .15, -.33, .025, .14, .28, .19);
    block(group, charcoal, side * .15, -.44, .13, .15, .12, .32);
  }
  block(group, charcoal, -.30, -.125, .32, .11, .10, .20);
  const muzzle = block(group, burst, -.30, -.12, .48, .19, .14, .19);
  muzzle.visible = false;
  return { x: x + side * 1.05, z, group, head, chest, muzzle, index: i };
});

const keys = new Set();
const ray = new THREE.Raycaster();
const aimRay = new THREE.Raycaster();
const from = new THREE.Vector3();
const to = new THREE.Vector3();
const direction = new THREE.Vector3();
const effects = [];
const flashMaterial = new THREE.LineBasicMaterial({ color: '#ffcf82' });
const hostileMaterial = new THREE.LineBasicMaterial({ color: '#ff5a4e' });
let audio;
let state = 'intro';
let seconds = 35;
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
  const duration = { fire: .23, enemy: .14, reload: .11, empty: .045 }[type];
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  tone.type = type === 'fire' ? 'sawtooth' : 'triangle';
  tone.frequency.setValueAtTime({ fire: 160, enemy: 300, reload: 950, empty: 530 }[type], now);
  tone.frequency.exponentialRampToValueAtTime(type === 'fire' ? 34 : 89, now + duration);
  volume.gain.setValueAtTime(type === 'fire' ? .19 : .064, now);
  volume.gain.exponentialRampToValueAtTime(.001, now + duration);
  tone.connect(volume).connect(audio.destination);
  tone.start(now);
  tone.stop(now + duration);
}

function trail(startPoint, endPoint, material, lifetime) {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]), material);
  scene.add(line);
  effects.push({ line, remaining: lifetime });
}

function sparks(point, colorMaterial) {
  for (let i = 0; i < 7; i++) {
    const end = point.clone().add(new THREE.Vector3((random() - .5) * .62, random() * .43, (random() - .5) * .55));
    trail(point, end, colorMaterial, .09 + random() * .08);
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
  camera.position.set(0, 1.57, 3.1);
  yaw = 0;
  pitch = 0;
  seconds = 35;
  runTime = 0;
  ammo = 6;
  cooldown = recoil = reloadTime = hurt = hitMark = 0;
  for (const enemy of enemies) {
    enemy.group.visible = true;
    enemy.group.position.set(enemy.x, .48, enemy.z);
    enemy.muzzle.visible = false;
    enemy.health = 2;
    enemy.alert = null;
    enemy.cycle = -1;
  }
  for (const { line } of effects.splice(0)) {
    line.removeFromParent();
    line.geometry.dispose();
  }
}

function enter() {
  if (state === 'playing') return;
  if (state !== 'paused') reset();
  state = 'playing';
  overlay.hidden = true;
  hud.hidden = false;
  document.body.classList.add('playing');
  const context = window.AudioContext ?? window.webkitAudioContext;
  if (context) {
    audio ??= new context();
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
  ray.far = direction.length() - .03;
  return ray.intersectObjects(colliders, false).length > 0;
}

function shoot() {
  if (state !== 'playing' || cooldown || reloadTime) return;
  if (!ammo) {
    sound('empty');
    cooldown = .2;
    return;
  }
  ammo--;
  cooldown = .33;
  recoil = 1;
  sound('fire');
  aimRay.setFromCamera(new THREE.Vector2(), camera);
  aimRay.far = 65;
  const targets = enemies.filter((enemy) => enemy.health > 0).flatMap(({ head, chest }) => [head, chest]);
  const hit = aimRay.intersectObjects([...colliders, ...targets], false)[0];
  const end = hit?.point ?? aimRay.ray.at(50, new THREE.Vector3());
  flash.getWorldPosition(from);
  trail(from, end, flashMaterial, .055);
  if (!hit) return;
  const enemy = enemies.find(({ head, chest }) => hit.object === head || hit.object === chest);
  if (enemy) {
    enemy.health -= hit.object === enemy.head ? 2 : 1;
    enemy.group.visible = enemy.health > 0;
    hitMark = .16;
    enemy.alert ??= runTime;
  }
  sparks(end, enemy ? hostileMaterial : flashMaterial);
}

function move(dt) {
  if (keys.has('ArrowLeft')) yaw += dt * 1.75;
  if (keys.has('ArrowRight')) yaw -= dt * 1.75;
  if (keys.has('ArrowUp')) pitch += dt * 1.25;
  if (keys.has('ArrowDown')) pitch -= dt * 1.25;
  pitch = THREE.MathUtils.clamp(pitch, -1.3, 1.3);
  const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const ahead = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
  const stride = 6.6 * dt / Math.max(1, Math.hypot(strafe, ahead));
  const dx = (Math.cos(yaw) * strafe - Math.sin(yaw) * ahead) * stride;
  const dz = (-Math.sin(yaw) * strafe - Math.cos(yaw) * ahead) * stride;
  const pos = camera.position;
  const blocked = (x, z) => z > 5.4 || walls.some(({ min, max }) =>
    x > min.x - .24 && x < max.x + .24 && z > min.z - .24 && z < max.z + .24);
  if (!blocked(pos.x + dx, pos.z)) pos.x += dx;
  if (!blocked(pos.x, pos.z + dz)) pos.z += dz;
  pos.y = 1.57 + (ahead || strafe ? Math.sin(runTime * 14) * .035 : 0);
  camera.rotation.set(pitch + recoil * .023, yaw, 0, 'YXZ');
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const { group, index } = enemy;
    group.rotation.y = Math.atan2(camera.position.x - group.position.x, camera.position.z - group.position.z);
    if (enemy.alert === null && camera.position.distanceTo(group.position) < 19) {
      to.set(enemy.x, 1.65, enemy.z);
      if (!hasCover(camera.position, to)) enemy.alert = runTime;
    }
    const age = enemy.alert === null ? -1 : runTime - enemy.alert - .25 * index;
    const cycle = Math.floor(age / 3.1);
    const phase = age % 3.1;
    const exposure = age < 0 ? 0 :
      THREE.MathUtils.smoothstep(phase, .56, .91) * (1 - THREE.MathUtils.smoothstep(phase, 1.96, 2.28));
    group.position.z = enemy.z + exposure * .54;
    group.position.y = THREE.MathUtils.lerp(group.position.y, .46 + exposure * .91, Math.min(1, 21 * dt));
    enemy.muzzle.visible = false;
    if (phase < 1.33 || phase > 1.94 || enemy.cycle === cycle) continue;
    from.copy(group.position);
    from.y += .04;
    to.copy(camera.position);
    if (hasCover(from, to)) continue;
    enemy.cycle = cycle;
    enemy.muzzle.visible = true;
    seconds -= 3.5;
    hurt = .66;
    trail(from, to, hostileMaterial, .11);
    sound('enemy');
  }
}

function update(dt) {
  runTime += dt;
  seconds -= dt;
  cooldown = Math.max(0, cooldown - dt);
  recoil = Math.max(0, recoil - 7 * dt);
  hurt = Math.max(0, hurt - 2.5 * dt);
  hitMark = Math.max(0, hitMark - dt);
  if (reloadTime > 0) {
    reloadTime -= dt;
    if (reloadTime <= 0) {
      reloadTime = 0;
      ammo = 6;
      sound('reload');
    }
  }
  move(dt);
  updateEnemies(dt);
  timeReadout.textContent = Math.max(0, seconds).toFixed(1);
  ammoReadout.textContent = '◆'.repeat(ammo) + '◇'.repeat(6 - ammo);
  ammoReadout.setAttribute('aria-label', reloadTime ? 'Перезарядка' : `Патроны: ${ammo} из 6`);
  damage.style.opacity = String(hurt);
  document.querySelector('#crosshair').textContent = hitMark > 0 ? '×' : '+';
  if (seconds <= 0) menu('lost', 'Отключение', 'Время до деактивации истекло.', 'Повторить');
  else if (camera.position.z < -44.75 && Math.abs(camera.position.x) < 1.22) {
    menu('won', 'Выход', `До деактивации оставалось ${seconds.toFixed(1)} с.`, 'Ещё раз');
  }
}

function resize() {
  const { innerWidth, innerHeight } = window;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  const height = Math.min(420, innerHeight);
  renderer.setSize(Math.ceil(height * camera.aspect), height, false);
}

function frame(now) {
  const dt = Math.min(.045, (now - lastFrame) / 1000);
  lastFrame = now;
  if (state === 'playing') update(dt);
  else damage.style.opacity = '0';
  const bob = state === 'playing' ? (camera.position.y - 1.57) * .36 : 0;
  weapon.position.set(.205, -.199 + bob + recoil * .04 - (reloadTime ? .115 : 0), -.44 + recoil * .055);
  weapon.rotation.set(.06 + recoil * .24, -.065, reloadTime ? -.48 : -.04);
  flash.visible = recoil > .66;
  for (let i = 0; i < rainPoints.length; i += 6) {
    rainPoints[i + 1] -= dt * (10 + (i % 11) * .4);
    if (rainPoints[i + 1] < -.25) rainPoints[i + 1] += 14;
    rainPoints[i + 3] = rainPoints[i] + .042;
    rainPoints[i + 4] = rainPoints[i + 1] + .32;
    rainPoints[i + 5] = rainPoints[i + 2] + .025;
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
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

start.addEventListener('click', enter);
window.addEventListener('resize', resize);
window.addEventListener('blur', () => keys.clear());
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing') menu('paused', 'Пауза', 'Таймер остановлен.', 'Продолжить');
});
document.addEventListener('keydown', (event) => {
  if (state !== 'playing') return;
  if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  keys.add(event.code);
  if (event.code === 'KeyR' && ammo < 6 && reloadTime === 0) {
    reloadTime = .83;
    sound('reload');
  }
  if (event.code === 'Escape' && !document.pointerLockElement) menu('paused', 'Пауза', 'Таймер остановлен.', 'Продолжить');
  if (event.code === 'Space' && !event.repeat) shoot();
});
document.addEventListener('keyup', (event) => keys.delete(event.code));
document.addEventListener('mousemove', (event) => {
  if (state !== 'playing' || document.pointerLockElement !== renderer.domElement) return;
  const scale = originalSensitivity * sensitivity / 100;
  yaw -= event.movementX * scale;
  pitch -= event.movementY * scale;
});
renderer.domElement.addEventListener('mousedown', (event) => {
  if (event.button === 0) shoot();
});

reset();
resize();
requestAnimationFrame(frame);
