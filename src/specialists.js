import * as T from 'three';
import {block,glow,solid} from './city.js';
const steel=solid('#3b3f4e'),trim=solid('#b9ab8c'),optic=glow('#3a63ff'),warning=glow('#ff9a3c');
export function specialistKind(i,total){
 if(i===Math.floor(total*.55))return 'runner';
 if(i>6&&i%11===8)return 'shield';
 if(i>5&&i%9===7)return 'drone';
}
export function specialist(scene,kind,s){
 const group=new T.Group();scene.add(group);
 const base=kind==='runner'?s.slabs.find(p=>p.layer==='I').a:s.enemy;
 let head,chest,shield;
 if(kind==='drone'){
   chest=block(group,steel,0,0,0,.96,.27,.72);
   for(const side of [-1,1]){
     block(group,trim,side*.49,.03,0,.31,.19,.57);
     block(group,optic,side*.49,-.08,.02,.2,.034,.45);
   }
   head=block(group,optic,0,.03,.4,.25,.15,.11);
 }else{
   chest=block(group,kind==='runner'?trim:steel,0,.03,0,.56,.62,.33);
   head=block(group,trim,0,.46,0,.29,.32,.28);
   block(group,optic,0,.47,.15,.24,.05,.04);
   for(const side of [-1,1]){
     block(group,steel,side*.16,-.55,0,.2,.69,.22);
     block(group,trim,side*.35,.02,0,.18,.46,.24);
   }
   if(kind==='shield'){
     shield=block(group,steel,-.06,0,.33,.83,1.35,.14);
     block(group,trim,-.06,.17,.41,.68,.12,.04);
   }else block(group,warning,.37,-.16,.14,.23,.21,.38);
 }
 const muzzle=block(group,warning,0,.14,.45,.14,.08,.08);muzzle.visible=false;
 group.position.set(base.x,kind==='drone'?4:(base.y||0)+.92,base.z);
 group.updateMatrixWorld(true);
 return {kind,segment:s.i,x:base.x,z:base.z,group,head,chest,shield,muzzle,health:kind==='runner'?5:3,next:0,windup:null};
}
const direction=new T.Vector3();
export function updateSpecial(e,camera,seg,t,dt,hasCover,fire,damage,warn){
 const p=e.group.position;
 if(e.kind==='drone'){
   const slab=seg.slabs[0];p.x=e.x+slab.dx*Math.sin(t*.6)*3;p.z=e.z+slab.dz*Math.sin(t*.6)*3;p.y=4+Math.sin(t)*.32;
 }
 direction.subVectors(camera.position,p);
 const range=direction.length(),angle=Math.atan2(direction.x,direction.z);
 if(range>26||hasCover(p,camera.position)){e.windup=null;e.muzzle.visible=false;return;}
 const diff=Math.atan2(Math.sin(angle-e.group.rotation.y),Math.cos(angle-e.group.rotation.y));
 e.group.rotation.y+=Math.sign(diff)*Math.min(Math.abs(diff),dt*(e.kind==='shield'?1.5:5));
 if(e.kind!=='drone'){
   if(Math.abs(direction.y)>1.9)return;
   if(range>1.4){const v=(e.kind==='runner'?4.4:1.2)*dt;direction.normalize();
     const end=e.kind==='runner'?seg.exit.I:seg.exit.G,start=e.kind==='runner'?seg.entry.I:seg.entry.G;
     p.x=T.MathUtils.clamp(p.x+direction.x*v,Math.min(start.x,end.x)-1,Math.max(start.x,end.x)+1);
     p.z=T.MathUtils.clamp(p.z+direction.z*v,Math.min(start.z,end.z)-1,Math.max(start.z,end.z)+1);return;}
 }
 if(t<e.next)return;
 if(e.windup===null){e.windup=t;e.muzzle.visible=true;warn();return;}
 if(t-e.windup<(e.kind==='drone'?.5:.35))return;
 if(e.kind==='drone')fire(p,camera.position,5);else if(range<1.65)damage(6);
 e.windup=null;e.next=t+2.8;e.muzzle.visible=false;
}
