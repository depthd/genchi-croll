import {sequence} from './gen/sequencer.js';
import {advance} from './gen/physics.js';
import {stream} from './gen/stream.js';
import {route,drawMap} from './gen/route.js';
import {campaign,save,restartCampaign} from './campaign.js';
import {pipeline} from './render.js';
import {config, query} from './config.js';
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

const pixels = pipeline(renderer,[240,270,360].includes(Number(query.get('res'))) ? Number(query.get('res')) : config.resolution);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0f24');
scene.fog = new THREE.FogExp2('#0a0f24', .034);
scene.add(new THREE.HemisphereLight('#a7bdf5', '#766563', 2));
const moon = new THREE.DirectionalLight('#8994dd', .65);
moon.position.set(-5, 14, 8);
scene.add(moon);

const camera = new THREE.PerspectiveCamera(67, 1, .035, 100);
camera.rotation.order = 'YXZ';
scene.add(camera);
const plan=route(campaign.seed), segments=sequence(plan);
const world=stream(scene,plan,segments);
const colliders=world.colliders, ambushes=[];
let distance=0;
const body={x:0,y:0,z:0,vy:0,grace:0};
let feet=0, vertical=0, grace=0, jumpQueue=0, vx=0, vz=0, inserted=0, reloadPhase='';
const darkSteel = solid('#1d2447');
const silver = solid('#8e8990');
const charcoal = solid('#6b3e22');
const amber = glow('#ffac46');
const optic = glow('#3a63ff');
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
const rainCount = 820;
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

const enemies = ambushes.map(({ kind, x, z, peekX, peekZ }) => {
  const standing = kind === 'corner';
  const group = new THREE.Group();
  scene.add(group);
  const head = block(group, silver, 0, .27, 0, .31, .29, .28);
  const chest = block(group, darkSteel, 0, -.055, -.02, .52, .32, .34);
  block(group, optic, 0, .30, .147, .23, .047, .024);
  block(group, charcoal, 0, .025, .164, .19, .13, .07);
  for (const side of [-1, 1]) {
    block(group, silver, side * .3, -.035, .015, .15, .21, .20);
    block(group, darkSteel, side * .31, -.15, .12, .125, .12, .31);
    if (standing) {
      block(group, darkSteel, side * .15, -.49, .025, .14, .58, .19);
      block(group, silver, side * .15, -.96, .025, .13, .41, .16);
    } else {
      block(group, darkSteel, side * .15, -.33, .025, .14, .28, .19);
    }
    block(group, charcoal, side * .15, standing ? -1.19 : -.44, .13, .15, .12, .32);
  }
  block(group, charcoal, -.30, -.125, .32, .11, .10, .20);
  const muzzle = block(group, burst, -.30, -.12, .48, .19, .14, .19);
  muzzle.visible = false;
  return { x, z, peekX, peekZ, standing, group, head, chest, muzzle, rifle:standing };
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
let seconds=config.startTime, bodySpeed=0, transfer=0;
const bodyId=document.querySelector('#body-id'), progress=document.querySelector('#progress'), delta=document.querySelector('#delta');
document.querySelector('#new-campaign').onclick=restartCampaign;
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
  const shots=[1,3,6,0,2,segments.length-1];
  const named={start:0,alley:1,fork:6,upper:6,shortcut:3,block:9,yard:segments.length-1};
  const at=query.get('at')||'';
  const relay=Number(query.get('relay'))||campaign.relay;
  const i=Math.min(segments.length-1,Math.max(0,Number(at.match(/^seg(\d+)$/)?.[1]??named[at]??shots[Number(query.get('shot'))-1]??plan.relays[relay-1]??0)));
  const layer=query.get('layer')||(at==='upper'||query.get('shot')==='3'?'R':at==='shortcut'||query.get('shot')==='2'?'I':'G');
  const port=segments[i].entry[layer]||segments[i].entry.G,c=plan.cells[i];
  world.sync(i);Object.assign(body,{x:port.x+c.dx*.3,y:port.y,z:port.z+c.dz*.3,vy:0,grace:config.jumpBuffer});
  camera.position.set(body.x,body.y+config.eye,body.z);distance=i;
  feet=vertical=jumpQueue=vx=vz=0; grace=config.jumpBuffer; reloadPhase='';
  yaw=Math.atan2(-c.dx,-c.dz);pitch=0;camera.rotation.set(0,yaw,0,'YXZ');
  const chassis=campaign.attempts===0?0:(campaign.attempts%3);
  seconds=config.startTime+[0,-10,10][chassis];bodySpeed=[0,.4,-.3][chassis];
  bodyId.textContent='ТЕЛО №'+(campaign.attempts+1)+' · '+['Обычный','Лёгкий','Прочный'][chassis];
  delta.textContent='';
  runTime = 0;
  ammo = 6;
  cooldown = recoil = reloadTime = hurt = hitMark = 0;
  for (const enemy of enemies) {
    enemy.group.visible = true;
    enemy.group.position.set(enemy.x, enemy.standing ? 1.25 : .46, enemy.z);
    enemy.muzzle.visible = false;
    enemy.health = enemy.rifle?3:2; enemy.volley=0;
    enemy.alert = null;
    enemy.cycle = -1;
  }
  for(const b of bullets.splice(0))b.mesh.removeFromParent();
  for (const { line } of effects.splice(0)) {
    line.removeFromParent();
    line.geometry.dispose();
  }
}

function enter() {
  if (state === 'playing') return;
  if (state !== 'paused') {reset();campaign.attempts++;save();}
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
  if (state !== 'playing' || cooldown || (reloadTime && !inserted)) return;
  reloadTime=0; reloadPhase=''; inserted=0;
  if (!ammo) {
    sound('empty');
    cooldown = .2;
    return;
  }
  ammo--;
  cooldown = config.fireDelay;
  recoil = 1;
  sound('fire');
  const spread=THREE.MathUtils.degToRad(grace<=0?3:Math.hypot(vx,vz)>6.2?2.5:Math.hypot(vx,vz)>.1?1.2:.2);
  aimRay.setFromCamera(new THREE.Vector2((random()-.5)*spread,(random()-.5)*spread), camera);
  cylinder.rotation.y+=Math.PI/3;
  aimRay.far = 65;
  const targets = enemies.filter((enemy) => enemy.health > 0).flatMap(({ head, chest }) => [head, chest]);
  const hit = aimRay.intersectObjects([...colliders, ...targets], false)[0];
  const end = hit?.point ?? aimRay.ray.at(50, new THREE.Vector3());
  flash.getWorldPosition(from);
  trail(from, end, flashMaterial, .055);
  if (!hit) return;
  const enemy = enemies.find(({ head, chest }) => hit.object === head || hit.object === chest);
  if (enemy) {
    enemy.health -= hit.object === enemy.head ? 3 : 1;
    enemy.group.visible = enemy.health > 0;
    if(enemy.health<=0){const bonus=hit.object===enemy.head?config.headBonus:config.killBonus;seconds=Math.min(config.cap,seconds+bonus);delta.textContent='+'+bonus.toFixed(1);}
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
  const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');
  const stride=((sprint?config.sprint:config.walk)+bodySpeed)/Math.max(1,Math.hypot(strafe,ahead));
  const blend=Math.min(1,dt*24*(grace>0?1:config.airControl));
  vx+=((Math.cos(yaw)*strafe-Math.sin(yaw)*ahead)*stride-vx)*blend;
  vz+=((-Math.sin(yaw)*strafe-Math.cos(yaw)*ahead)*stride-vz)*blend;
  const pos=camera.position;
  advance(body,world.near,vx*dt,vz*dt,dt,jumpQueue>0);
  if(body.vy>0)jumpQueue=0;
  jumpQueue=Math.max(0,jumpQueue-dt);feet=body.y;grace=body.grace;
  pos.set(body.x,body.y+config.eye,body.z);
  distance=world.locate(pos);
  const relay=plan.relays.indexOf(world.index)+1;
  if(relay>campaign.relay&&Math.abs(distance-world.index)<.4){
    campaign.relay=relay;save();seconds=Math.min(config.cap,seconds+config.relayBonus);delta.textContent='Ретранслятор · +30';sound('reload');
  }
  if(body.y < -12)seconds=0;
  const fov=67+(sprint&&ahead?6:0);
  if(Math.abs(camera.fov-fov)>.05){camera.fov+=(fov-camera.fov)*Math.min(1,dt*9);camera.updateProjectionMatrix();}
  camera.rotation.set(pitch + recoil * .023, yaw, 0, 'YXZ');
}

const bullets=[];
function projectiles(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i], step=Math.min(b.range,dt*70);
    const previous=b.mesh.position;
    ray.set(previous,b.dir);ray.far=step;
    let stopped=ray.intersectObjects(colliders,false).length>0;
    const next=to.copy(previous).addScaledVector(b.dir,step);
    if(!stopped){
      const closest=new THREE.Line3(previous,next).closestPointToPoint(camera.position,true,from);
      if(closest.distanceTo(camera.position)<.42){if(!query.has('god'))seconds-=b.damage;delta.textContent='−'+b.damage.toFixed(1);hurt=.8;stopped=true;}
    }
    previous.copy(next);b.range-=step;
    if(stopped||b.range<=0){b.mesh.removeFromParent();bullets.splice(i,1);}
  }
}
function updateEnemies(dt) {
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const { group, standing } = enemy;
    group.rotation.y = Math.atan2(camera.position.x - group.position.x, camera.position.z - group.position.z);
    if (enemy.alert === null && camera.position.distanceTo(group.position) < 19) {
      to.set(enemy.x + enemy.peekX, 1.65, enemy.z + enemy.peekZ);
      if (!hasCover(camera.position, to)) enemy.alert = runTime;
    }
    const age = enemy.alert === null ? -1 : runTime - enemy.alert;
    const cycle = Math.floor(age / 3.1);
    const phase = age % 3.1;
    const exposure = age < 0 ? 0 :
      THREE.MathUtils.smoothstep(phase, .56, .91) * (1 - THREE.MathUtils.smoothstep(phase, 1.96, 2.28));
    const blend = Math.min(1, 21 * dt);
    group.position.x = THREE.MathUtils.lerp(group.position.x, enemy.x + exposure * enemy.peekX, blend);
    group.position.z = THREE.MathUtils.lerp(group.position.z, enemy.z + exposure * enemy.peekZ, blend);
    if (!standing) {
      group.position.y = THREE.MathUtils.lerp(group.position.y, .46 + exposure * .91, blend);
    }
    enemy.muzzle.visible = false;
    const shot=Math.min(enemy.rifle?2:0,Math.floor((phase-1.33)/.14));
    if(age>=0&&phase>.91&&phase<1.33){enemy.muzzle.visible=true;if(enemy.warned!==cycle){sound('empty');enemy.warned=cycle;}}
    if (phase < 1.33 || phase > 1.94 || enemy.cycle === cycle*3+shot) continue;
    from.copy(group.position);
    from.y += .04;
    to.copy(camera.position);
    if (hasCover(from, to)) continue;
    enemy.cycle = cycle*3+shot;
    enemy.muzzle.visible = true;
    const mesh=block(scene,burst,from.x,from.y,from.z,.045,.045,.48);
    mesh.lookAt(to); bullets.push({mesh,dir:to.clone().sub(from).normalize(),range:40,damage:enemy.rifle?3:4});
    sound('enemy');
  }
}

function update(dt) {
  runTime += dt;
  if (!query.has('god')) seconds -= dt;
  cooldown = Math.max(0, cooldown - dt);
  recoil = Math.max(0, recoil - 7 * dt);
  hurt = Math.max(0, hurt - 2.5 * dt);
  hitMark = Math.max(0, hitMark - dt);
  if (reloadTime > 0) {
    reloadTime -= dt;
    if (reloadTime <= 0) {
      reloadTime = 0;
      if(reloadPhase==='open'){reloadPhase='round';reloadTime=config.reloadRound;}
      else if(reloadPhase==='round'){
        ammo++; inserted++; sound('reload');
        if(ammo===6){reloadPhase='close'; reloadTime=config.reloadClose;}
        else reloadTime=config.reloadRound;
      } else {reloadPhase='';inserted=0;}
    }
  }
  move(dt);
  updateEnemies(dt);projectiles(dt);
  const clock=Math.max(0,seconds);
  timeReadout.textContent=String(Math.floor(clock/60)).padStart(2,'0')+':'+(clock%60).toFixed(1).padStart(4,'0');
  timeReadout.style.color=seconds<10?'#ff3b3b':seconds<20?'#ff9a3c':'#7dff1a';
  progress.value=Math.min(1,Math.max(0,distance/segments.length));
  campaign.record=Math.max(campaign.record,progress.value);
  ammoReadout.textContent = '◆'.repeat(ammo) + '◇'.repeat(6 - ammo);
  ammoReadout.setAttribute('aria-label', reloadTime ? 'Перезарядка' : `Патроны: ${ammo} из 6`);
  damage.style.opacity = String(hurt);
  document.querySelector('#crosshair').textContent = hitMark > 0 ? '×' : '+';
  if(seconds<=0){
    state='transfer'; transfer=0; save(); keys.clear();
    title.textContent='Тело №'+campaign.attempts+' деактивировано';
    message.textContent='Сознание переносится… Ближе всех подобрался: '+Math.round(100*campaign.record)+'%';
  }
  else if (distance>segments.length-.14 && Math.abs(body.y)<1.7) {
    campaign.best=campaign.best===null?runTime:Math.min(runTime,campaign.best);save();
    menu('won', 'Сектор 02 — скоро', `До деактивации оставалось ${seconds.toFixed(1)} с.`, 'Ещё раз');
  }
}

function resize() {
  camera.aspect = 16 / 9;
  camera.updateProjectionMatrix();
}

let transferClock=performance.now();
function frame(now) {
  const dt = Math.min(.045, (now - lastFrame) / 1000);
  lastFrame = now;
  if (state === 'playing') update(dt);
  else if(state==='transfer'){
    transfer+=Math.max(0,(now-transferClock)/1000);
    damage.style.opacity=String(Math.min(1,transfer));
    if(transfer>=1.8){overlay.hidden=false;overlay.classList.add('transfer');hud.hidden=true;}
    if(transfer>=3.8){overlay.classList.remove('transfer');enter();}
  } else damage.style.opacity = '0';
  transferClock=now;
  const bob = state === 'playing' ? Math.sin(runTime*12)*Math.min(.003,Math.hypot(vx,vz)*.0005) : 0;
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
  if(map.isConnected)drawMap(map,plan,camera.position,segments);
  rain.position.copy(camera.position);
  pixels.render(scene, camera);
  if (stats.isConnected && now - (stats.last || 0) > 500) {
    stats.textContent = Math.round(1 / dt) + ' кадр/с · вызовы ' + renderer.info.render.calls + ' · треуг. ' + renderer.info.render.triangles + ' · враги ' + enemies.length;
    stats.last = now;
  }
  requestAnimationFrame(frame);
}

start.addEventListener('click', enter);
window.addEventListener('resize', resize);
window.addEventListener('blur', () => {keys.clear();if(state==='playing')menu('paused','Пауза','Таймер остановлен.','Продолжить');});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing') menu('paused', 'Пауза', 'Таймер остановлен.', 'Продолжить');
});
document.addEventListener('keydown', (event) => {
  if (state !== 'playing') return;
  if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  keys.add(event.code);
  if (event.code === 'KeyR' && ammo < 6 && reloadTime === 0) {
    reloadTime=config.reloadOpen; reloadPhase='open'; inserted=0;
    sound('reload');
  }
  if (event.code === 'Escape' && !document.pointerLockElement) menu('paused', 'Пауза', 'Таймер остановлен.', 'Продолжить');
  if (event.code === 'Space' && !event.repeat) jumpQueue=config.jumpBuffer;
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

const map=document.createElement('canvas');
if(query.get('gen')==='debug'){map.id='gen-map';map.width=map.height=420;document.body.append(map);drawMap(map,plan,camera.position);}
const stats = document.createElement('output');
if (query.has('debug')) {
  const panel = document.createElement('aside');
  panel.id = 'debug';
  panel.append(stats);
  for (const key of ['walk','sprint','fireDelay','startTime']) {
    const label = document.createElement('label');
    label.textContent = key;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '.1';
    input.value = config[key];
    input.onchange = () => { if (input.valueAsNumber > 0) config[key] = input.valueAsNumber; };
    label.append(input);
    panel.append(label);
  }
  document.body.append(panel);
}
window.GAME = {camera, enemies, config,plan,segments,world,body,renderer,campaign, get seconds(){return seconds}, get state(){return state}};
scene.traverse(o => {if (o.material) for (const m of [].concat(o.material)) pixels.snap(m);});
reset();
if(query.has('shot')){overlay.hidden=true;document.body.classList.add('photo');}
resize();
requestAnimationFrame(frame);
