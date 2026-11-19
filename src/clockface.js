const masks = [0x3f, 6, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 7, 0x7f, 0x6f];
const bars = [
  [2, 0, 8, 2],
  [10, 2, 2, 7],
  [10, 11, 2, 7],
  [2, 18, 8, 2],
  [0, 11, 2, 7],
  [0, 2, 2, 7],
  [2, 9, 8, 2],
];
export function clockface(readout) {
  const canvas = document.createElement('canvas');
  canvas.width = 84;
  canvas.height = 20;
  canvas.id = 'clockface';
  canvas.setAttribute('aria-hidden', 'true');
  readout.after(canvas);
  const c = canvas.getContext('2d');
  let last = '';
  return (clock) => {
    const ticks = Math.max(0, Math.ceil(clock * 10)),
      minutes = Math.floor(ticks / 600);
    const text =
      String(minutes).padStart(2, '0') +
      ':' +
      String(Math.floor(ticks / 10) % 60).padStart(2, '0') +
      '.' +
      (ticks % 10);
    if (text === last) return;
    last = text;
    readout.textContent = text;
    c.clearRect(0, 0, 84, 20);
    let x = 1;
    const bright = clock < 10 ? '#ff3b3b' : clock < 20 ? '#ff9a3c' : '#7dff1a';
    for (const ch of text) {
      c.fillStyle = bright;
      if (ch === ':' || ch === '.') {
        c.fillRect(x, ch === ':' ? 4 : 17, 2, 2);
        if (ch === ':') c.fillRect(x, 14, 2, 2);
        x += 6;
        continue;
      }
      for (let i = 0; i < 7; i++) {
        c.fillStyle = masks[Number(ch)] & (1 << i) ? bright : '#273328';
        const [dx, y, w, h] = bars[i];
        c.fillRect(x + dx, y, w, h);
      }
      x += 14;
    }
  };
}
