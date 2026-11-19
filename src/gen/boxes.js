export function boxCoordinates(box, x, z) {
  const dx = box.dx ?? 0,
    dz = box.dz ?? 1,
    rx = x - box.x,
    rz = z - box.z;
  return { x: -dz * rx + dx * rz, z: dx * rx + dz * rz };
}
export function overlapsBox(box, x, y, z, radius = 0.28, height = 1.7) {
  const p = boxCoordinates(box, x, z);
  return (
    Math.abs(p.x) < box.w / 2 + radius &&
    Math.abs(p.z) < box.d / 2 + radius &&
    y + height > box.y - box.h / 2 + 0.015 &&
    y + 0.12 < box.y + box.h / 2
  );
}
