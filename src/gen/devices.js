import { config } from '../config.js';
export function useDevice(body, segments, dx, dz, dt) {
  if (!body.ride && Math.hypot(dx, dz) > 0.0001) {
    for (const seg of segments)
      for (const device of seg.devices) {
        if (body.lastDevice === device) {
          if (Math.hypot(body.x - device.x, body.z - device.z) > 1) body.lastDevice = null;
          continue;
        }
        if (Math.hypot(body.x - device.x, body.z - device.z) > 0.52) continue;
        const end =
          Math.abs(body.y - device.low) < 0.38
            ? device.high
            : Math.abs(body.y - device.high) < 0.38
              ? device.low
              : null;
        if (end !== null) {
          body.ride = { device, end };
          break;
        }
      }
  }
  if (!body.ride) return false;
  const { device, end } = body.ride,
    delta = end - body.y;
  body.x = device.x;
  body.z = device.z;
  body.y += Math.sign(delta) * Math.min(Math.abs(delta), config.ladderSpeed * dt);
  body.vy = 0;
  body.grace = 0;
  if (Math.abs(body.y - end) < 1e-6) {
    body.ride = null;
    body.lastDevice = device;
    body.grace = config.jumpBuffer;
  }
  return true;
}
