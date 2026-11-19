import * as T from 'three';
import {atlas,skin} from './skin.js';
export function dressing(plan){
 const material=atlas(),worker=new Worker(new URL('./skin-worker.js',import.meta.url),{type:'module'});
 const pending=new Map();let serial=0,failed=false;
 worker.postMessage({plan});
 worker.onerror=()=>{failed=true;for(const job of pending.values())if(job.group.parent)skin(plan)(job.group,job.segment,[]);pending.clear();worker.terminate();};
 worker.onmessage=({data})=>{
   const job=pending.get(data.id);pending.delete(data.id);
   if(!job?.group.parent)return;
   const geo=new T.BufferGeometry();
   for(const [key,a] of Object.entries(data.attributes))geo.setAttribute(key,new T.BufferAttribute(a.array,a.size));
   geo.setIndex(new T.BufferAttribute(data.index,1));const mesh=new T.Mesh(geo,material);
   mesh.userData.owned=true;job.group.add(mesh);job.group.userData.dressed=true;
 };
 return (group,segment,hits)=>{
   if(failed){skin(plan)(group,segment,hits);return;}
   for(const m of group.children)m.visible=false;
   const id=serial++;pending.set(id,{group,segment});worker.postMessage({id,segment});
 };
}
