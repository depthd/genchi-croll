import assert from 'node:assert/strict';
import {route} from '../src/gen/route.js';
import {sequence} from '../src/gen/sequencer.js';
import {advance} from '../src/gen/physics.js';
import {layers} from '../src/gen/segments.js';
const seeds=Number(process.argv[process.argv.indexOf('--seeds')+1])||100;
for(let seed=0;seed<seeds;seed++){
 const segments=sequence(route(seed));
 for(const layer of layers){
  const body={...segments[0].entry[layer],vy:0,grace:.1};
  for(const seg of segments){
   const near=segments.slice(Math.max(0,seg.i-1),seg.i+2),end=seg.exit[layer];
   const length=Math.hypot(end.x-body.x,end.z-body.z),steps=Math.ceil(length/(8/60));
   const dx=(end.x-body.x)/steps,dz=(end.z-body.z)/steps;let jumped=false;
   for(let i=0;i<steps;i++){
    const lip=seg.jumps.find(g=>g.layer===layer)?.a;
    const jump=!!lip&&!jumped&&Math.hypot(body.x-lip.x,body.z-lip.z)<.24;
    advance(body,near,dx,dz,1/60,jump);jumped||=jump;
    assert(body.y>=Math.min(end.y,seg.entry[layer].y)-.45,'Провал '+[seed,seg.i,layer,i,body.y]);
   }
   assert(Math.hypot(body.x-end.x,body.z-end.z)<.05&&Math.abs(body.y-end.y)<.46,'Стык '+[seed,seg.i,layer,body.y,end.y]);
  }
 }
}
console.log(seeds+' seeds × '+layers.length+' layers passed');
