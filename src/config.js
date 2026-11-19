export const config = {
  seed: 740, resolution: 270, walk: 6, sprint: 8, jump: 1.1, gravity: 24,
  eye: 1.6, step: .35, vault: 1.3, safeDrop: 6, jumpBuffer: .1, airControl: .6,
  startTime: 75, cap: 99.9, relayBonus: 30, reloadOpen: .4, reloadRound: .3,
  reloadClose: .3, fireDelay: .28, killBonus: 1.5, headBonus: 2.5
};
export const query = new URLSearchParams(globalThis.location?.search);
