import assert from 'node:assert/strict';
import {route} from '../src/gen/route.js';
for(let s=0;s<1000;s++){
 const r=route(s);assert(r.length>=1900&&r.length<=2100);assert.equal(new Set(r.relays).size,4);
 assert(r.relays.every(i=>r.turns.includes(i)));assert.equal(new Set(r.cells.map(p=>[p.x,p.z].join())).size,r.cells.length);
 for(const p of r.cells)for(const q of r.cells.slice(p.i+3))assert(Math.hypot(q.x-p.x,q.z-p.z)>=64);
}
console.log('1000 routes passed');
