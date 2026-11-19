import { query } from './config.js';
const currentKey = 'genchi-campaign-v1';
const fresh = (seed = crypto.getRandomValues(new Uint32Array(1))[0]) => ({
  seed,
  attempts: 0,
  relay: 0,
  record: 0,
  best: null,
});
function read(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    if (Number.isInteger(value?.seed)) return Object.assign(fresh(value.seed), value);
  } catch {}
}
const active = read(currentKey) ?? fresh();
const number = Number(query.get('seed'));
const explicit = query.has('seed') && Number.isInteger(number);
const seed = explicit ? number >>> 0 : active.seed;
const slot = currentKey + '-' + seed;
const preview = ['at', 'shot', 'bots', 'relay', 'god', 'gen'].some((key) => query.has(key));
export const campaign = (seed === active.seed ? active : read(slot)) ?? fresh(seed);
export function save() {
  if (preview) return;
  try {
    localStorage.setItem(slot, JSON.stringify(campaign));
    if (!explicit || seed === active.seed) localStorage.setItem(currentKey, JSON.stringify(campaign));
  } catch {}
}
export function restartCampaign() {
  const next = fresh();
  try {
    localStorage.setItem(currentKey, JSON.stringify(next));
  } catch {}
  location.replace(location.pathname);
}
save();
