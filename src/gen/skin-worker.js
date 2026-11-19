import * as T from 'three';
import { skin } from './skin.js';
let decorate;
self.onmessage = ({ data }) => {
  if (data.plan) {
    decorate = skin(data.plan);
    return;
  }
  const { id, segment } = data;
  const start = performance.now();
  const group = new T.Group();
  decorate(group, segment, []);
  const geom = group.children.at(-1).geometry,
    attributes = {};
  for (const [key, a] of Object.entries(geom.attributes))
    attributes[key] = { array: a.array, size: a.itemSize };
  const index = geom.index.array;
  self.postMessage({ id, index, attributes, duration: performance.now() - start }, [
    index.buffer,
    ...Object.values(attributes).map((a) => a.array.buffer),
  ]);
};
