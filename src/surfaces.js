import * as T from 'three';
const cache = new Map();
export function surface(kind, variant = 0) {
  const key = kind + variant;
  if (cache.has(key)) return cache.get(key);
  const colors = {
    tile: '#2c5754',
    brick: '#5e2b28',
    cement: '#6e6558',
    steel: '#3b3f4e',
    shutter: '#5a5750',
    asphalt: '#14151d',
    crate: '#6b3e22',
    bin: '#2f4a2a',
    stripe: '#b9ab58',
    check: '#2c5754',
    poster: '#b9ab8c',
    sign: '#1d2447',
    graffiti: '#5a5750',
  };
  let seed = Array.from(key).reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 91);
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const canvas =
    typeof document === 'undefined' ? new OffscreenCanvas(512, 512) : document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d');
  c.fillStyle = colors[kind];
  c.fillRect(0, 0, 64, 64);
  c.fillStyle = '#181c28';
  for (let y = 0; y < 64; y += 8) {
    if (['brick', 'tile', 'shutter', 'crate', 'steel'].includes(kind)) c.fillRect(0, y, 64, 1);
    for (let x = 0; x < 64; x += 16) {
      if (['brick', 'tile'].includes(kind))
        c.fillRect(x + (kind === 'brick' && y % 16 ? 8 : 0), y, 1, 8);
      if (kind === 'check') c.fillRect(x + (y % 16 ? 8 : 0), y, 8, 8);
    }
  }
  if (kind === 'stripe')
    for (let x = -64; x < 64; x += 16) {
      c.save();
      c.transform(1, 0, 0.8, 1, 0, 0);
      c.fillRect(x, 0, 8, 64);
      c.restore();
    }
  if (['bin', 'poster', 'sign'].includes(kind)) {
    c.fillStyle = kind === 'sign' ? '#ff9a3c' : '#6a5a2a';
    c.font = 'bold 13px monospace';
    c.fillText(['ЦЕХ', '07-4', 'УЧЁТ'][variant % 3], 6, 32);
  }
  for (let i = 0; i < 1200; i++) {
    c.fillStyle = rand() < 0.55 ? '#0a0f242b' : '#b9ab8c18';
    c.fillRect(rand() * 64, rand() * 64, 1 + rand() * 2, i % 70 === 0 ? 14 : 1);
  }
  const tex = new T.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.colorSpace = T.SRGBColorSpace;
  tex.minFilter = tex.magFilter = T.NearestFilter;
  const mat = new T.MeshLambertMaterial({ map: tex });
  cache.set(key, mat);
  return mat;
}
