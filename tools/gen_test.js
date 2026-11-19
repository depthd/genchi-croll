import {createHash} from 'node:crypto';
import {route} from '../src/gen/route.js';
import {sequence} from '../src/gen/sequencer.js';
import {layers,compatible} from '../src/gen/segments.js';
import {canTraverse,config} from '../src/config.js';
const seeds=Number(process.argv[process.argv.indexOf('--seeds')+1])||1000;
const totals=Array(9).fill(0),costs=Object.fromEntries(layers.map(k=>[k,[]]));
const digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
for(let seed=0;seed<seeds;seed++){
 const plan=route(seed),segments=sequence(plan),ok=Array(9).fill(true);
 let next=new Set(layers),exitGround=new Set(['G']);
 for(const s of segments.toReversed()){
   const live=new Set(),escape=new Set();
   for(const k of layers){
     const parts=s.slabs.filter(p=>!p.link&&p.layer===k);
     const pass=parts.length&&parts.every(p=>canTraverse(p.a,p.b,'ramp'))&&s.jumps.filter(j=>j.layer===k).every(j=>canTraverse(j.a,j.b));
     const end=s.exit[k],start=segments[s.i+1]?.entry[k];
     const join=!start||(compatible(end,start)&&Math.hypot(end.x-start.x,end.z-start.z)<.001);
     if(pass&&join&&next.has(k))live.add(k);
     if(pass&&join&&(k==='G'||exitGround.has(k)))escape.add(k);
   }
   for(let i=0;i<layers.length;i++)for(const l of s.links){
     if(!canTraverse(l.a,l.b,'ramp')){ok[5]=false;continue;}
     if(escape.has(l.from)||escape.has(l.to)){escape.add(l.from);escape.add(l.to);}
   }
   ok[0]&&=live.size===4;ok[1]&&=escape.size===4;ok[2]&&=live.size>=2;
   next=live;exitGround=escape;
 }
 for(const s of segments){
   const c=plan.cells[s.i];
   const bounds={x:c.x+c.dx*16,z:c.z+c.dz*16};
   for(const other of plan.cells.slice(s.i+2)){
     if(Math.abs(bounds.x-other.x-other.dx*16)<32&&Math.abs(bounds.z-other.z-other.dz*16)<32)ok[4]=false;
   }
   const shot={x:s.enemy.x+s.enemy.peekX,z:s.enemy.z+s.enemy.peekZ};
   for(const other of segments.slice(s.i+2)){
     if(Math.abs(c.x-plan.cells[other.i].x)>96||Math.abs(c.z-plan.cells[other.i].z)>96)continue;
     for(const a of s.slabs)for(const b of other.slabs){
       if(a.maxX>b.minX+.001&&a.minX<b.maxX-.001&&a.maxZ>b.minZ+.001&&a.minZ<b.maxZ-.001&&
         Math.max(a.a.y,a.b.y)>=Math.min(b.a.y,b.b.y)&&Math.max(b.a.y,b.b.y)>=Math.min(a.a.y,a.b.y))ok[4]=false;
     }
   }
   for(let d=0;d<12;d+=.25){
     if(Math.abs(shot.x-c.dx*d-s.cover.x)<s.cover.w/2&&Math.abs(shot.z-c.dz*d-s.cover.z)<s.cover.d/2)ok[8]=false;
   }
   ok[8]&&=Math.hypot(s.enemy.x-s.cover.x,s.enemy.z-s.cover.z)<3;
   ok[7]&&=s.slabs.length*12+12<150000/7&&s.slabs.length+1<250/7;
 }
 let start=0;
 for(const end of [...plan.relays,segments.length]){
   const values=layers.map(k=>{
     let time=0;
     for(const s of segments.slice(start,end)){
       const a=s.entry[k],b=s.exit[k];
       time+=Math.hypot(b.x-a.x,b.z-a.z,b.y-a.y)/config.sprint+.16*s.threat+Number(k==='R'&&s.jumps.length>0)*.25;
     }
     costs[k].push(time);return time;
   });
   ok[3]&&=Math.max(...values)<=Math.min(...values)*1.25;start=end;
 }
 ok[6]=digest(segments)===digest(sequence(route(seed)));
 ok.forEach((v,i)=>totals[i]+=Number(v));
}
const names=['Достижимость','Выход на улицу','Два слоя','Баланс','Границы участков','Метрики переходов','Хеш геометрии','Бюджет каркаса','Укрытие и видимость'];
console.table(Object.fromEntries(names.map((n,i)=>[n,(100*totals[i]/seeds).toFixed(2)+'%'])));
for(const [k,v] of Object.entries(costs)){v.sort((a,b)=>a-b);console.log(k,'секунды p10/p50/p90',...[.1,.5,.9].map(p=>v[Math.floor(v.length*p)].toFixed(1)));}
if(totals.some((v,i)=>v/seeds<([3,7].includes(i)?.98:1)))process.exitCode=1;
