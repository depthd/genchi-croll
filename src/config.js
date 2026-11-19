export const config = {
  bulletSpeed: 70,
  magazine: 6,
  damage: { patrol: 4, rifle: 3, drone: 5, melee: 6 },
  bodyTimes: [0, -10, 10],
  bodySpeeds: [0, 0.4, -0.3],
  transferSeconds: 3.8,
  transferFreeze: 1.8,
  sightInterval: 0.1,
  gunshotRadius: 25,
  threatTime: 0.16,
  jumpTime: 0.25,
  seed: 740,
  resolution: 270,
  walk: 6,
  sprint: 8,
  jump: 1.1,
  gravity: 24,
  eye: 1.6,
  step: 0.35,
  vault: 1.3,
  safeDrop: 6,
  jumpBuffer: 0.1,
  airControl: 0.6,
  startTime: 75,
  cap: 99.9,
  relayBonus: 30,
  reloadOpen: 0.4,
  reloadRound: 0.3,
  reloadClose: 0.3,
  fireDelay: 0.28,
  killBonus: 1.5,
  headBonus: 2.5,
};
export const query = new URLSearchParams(globalThis.location?.search);
Object.assign(config, {
  segment: 32,
  gap: 3.4,
  up: 0.8,
  downAllowance: 0.4,
  maxSlope: 30,
  ladderSpeed: 4.5,
  joinTolerance: 0.25,
  layers: {
    G: { y: 0, offset: 0, width: 5, kind: 'open' },
    R: { y: 9.6, offset: -9.5, width: 8, kind: 'bridge' },
    I: { y: 0.04, offset: 8.8, width: 3.4, kind: 'door' },
    U: { y: -4.5, offset: 0, width: 4, kind: 'hatch' },
  },
});
export function canTraverse(a, b, kind = 'gap') {
  const rise = b.y - a.y,
    run = Math.hypot(b.x - a.x, b.z - a.z);
  if (!Number.isFinite(run + rise)) return false;
  if (kind === 'ladder') return run <= 1;
  if (kind === 'ramp') return Math.abs(rise) <= run * Math.tan((config.maxSlope * Math.PI) / 180) + 1e-8;
  if (kind === 'vault') return rise <= config.vault && rise >= -config.safeDrop;
  return (
    rise <= config.up &&
    rise >= -config.safeDrop &&
    run <= config.gap + Math.max(0, -rise) * config.downAllowance + 1e-8
  );
}
