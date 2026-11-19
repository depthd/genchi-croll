import {config} from '../config.js';
const streets=['bins','barber','fork','barricade','market','alley'];
const roofs=['skylight','gap25','gap34','bridge'];
const rooms=['flat','kitchen','shop','stairwell'];
const drains=['pipe','branch','water'];
export const templates=Array.from({length:16},(_,i)=>({
 id:streets[i%6]+'_'+roofs[i%4]+'_'+i,street:streets[i%6],roof:roofs[i%4],room:rooms[(i+Math.floor(i/4))%4],drain:drains[i%3],
 weight:1+i%3,threat:1+i%4,minProgress:i===15?.35:0
}));
export const layers=Object.keys(config.layers);
export function compatible(a,b){
 return a.layer===b.layer&&a.kind===b.kind&&Math.abs(a.y-b.y)<=config.joinTolerance&&b.w>=a.w;
}
export const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
function port(plan,i,layer){
 const c=plan.cells[Math.min(i,plan.cells.length-1)],p=plan.cells[Math.max(0,i-1)],spec=config.layers[layer];
 const corner=c.dx!==p.dx||c.dz!==p.dz;
 const x=c.x+(i===plan.cells.length?c.dx*config.segment:0),z=c.z+(i===plan.cells.length?c.dz*config.segment:0);
 return {layer,kind:spec.kind,w:spec.width,x:x-spec.offset*(c.dz+(corner?p.dz:0)),z:z+spec.offset*(c.dx+(corner?p.dx:0)),
 y:plan.relays.includes(i)||i===0||i===plan.cells.length?0:spec.y};
}
export function slab(a,b,w,layer,link=false){
 const length=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
 return {a,b,w,layer,link,length,dx,dz,minX:Math.min(a.x,b.x)-Math.abs(dz)*w/2,maxX:Math.max(a.x,b.x)+Math.abs(dz)*w/2,minZ:Math.min(a.z,b.z)-Math.abs(dx)*w/2,maxZ:Math.max(a.z,b.z)+Math.abs(dx)*w/2};
}
export function buildSegment(plan,i,t){
 const entry={},exit={},slabs=[],jumps=[],links=[];
 for(const layer of layers){
   const a=entry[layer]=port(plan,i,layer),b=exit[layer]=port(plan,i+1,layer);
   const gap=layer==='R'&&a.y===b.y&&t.roof.startsWith('gap')?(t.roof==='gap25'?2.5:config.gap):0;
   if(!gap)slabs.push(slab(a,b,a.w,layer));
   else{
     const d=gap/Math.hypot(b.x-a.x,b.z-a.z)/2,l=mix(a,b,.5-d),r=mix(a,b,.5+d);
     slabs.push(slab(a,l,a.w,layer),slab(r,b,a.w,layer));jumps.push({a:l,b:r,layer});
   }
 }
 const junction=plan.relays.includes(i)||i===0,finish=i===plan.cells.length-1;
 for(const [from,to] of [['G','R'],['G','I'],['I','U']]){
   const flat=entry[from].y===exit[from].y&&entry[to].y===exit[to].y;
   if(!flat&&!junction&&!finish)continue;
   const a=mix(entry[from],exit[from],junction?0:finish?1:.12);
   const b=mix(entry[to],exit[to],junction?0:finish?1:.88);
   const path=slab(a,b,1.6,to,true);path.from=from;path.to=to;links.push(path);slabs.push(path);
 }
 const c=plan.cells[i],g=mix(entry.G,exit.G,.64);
 const cover={x:g.x-c.dz*1.95,y:0,z:g.z+c.dx*1.95,w:1,h:1.05,d:1};
 const enemy={x:cover.x+c.dx*1.6,y:0,z:cover.z+c.dz*1.6,peekX:c.dz*1.3,peekZ:-c.dx*1.3};
 return {i,id:t.id,template:t,entry,exit,slabs,links,jumps,cover,enemy,threat:t.threat};
}
