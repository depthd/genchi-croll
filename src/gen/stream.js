import * as T from 'three';
import {block} from '../city.js';
const palette={G:'#5a5750',I:'#6e6558',U:'#2c5754',R:'#3b3f4e',link:'#4fe7ff'};
export function stream(scene,plan,segments,decorate){
 const active=new Map(), colliders=[];
 let index=-1;
 const materials=Object.fromEntries(Object.entries(palette).map(([k,color])=>[k,new T.MeshLambertMaterial({color,side:T.DoubleSide})]));
 function build(s){
   const group=new T.Group(),hits=[];
   for(const p of s.slabs){
     const x=-p.dz*p.w/2,z=p.dx*p.w/2;
     const v=[];
     for(const [point,sign] of [[p.a,1],[p.a,-1],[p.b,-1],[p.b,1]])v.push(point.x+x*sign,point.y,point.z+z*sign);
     const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setIndex([0,1,2,0,2,3]);
     geo.setAttribute('uv',new T.Float32BufferAttribute([0,0,p.w/4,0,p.w/4,p.length/4,0,p.length/4],2));geo.computeVertexNormals();
     const mesh=new T.Mesh(geo,materials[p.link?'link':p.layer]);
     group.add(mesh);hits.push(mesh);mesh.userData.slab=p;
   }
   const b=s.cover;hits.push(block(group,materials.G,b.x,b.y+b.h/2,b.z,b.w,b.h,b.d));
   if(decorate)decorate(group,s,hits);
   scene.add(group);group.updateMatrixWorld(true);return {group,hits};
 }
 function sync(i){
   if(i===index)return;
   index=i;
   for(const [j,{group}] of active)if(j<i-1||j>i+5){
     group.removeFromParent();group.traverse(o=>{if(o.userData.slab||o.userData.owned)o.geometry.dispose();});active.delete(j);
   }
   for(let j=Math.max(0,i-1);j<=Math.min(segments.length-1,i+5);j++)if(!active.has(j))active.set(j,build(segments[j]));
   colliders.length=0;for(const {hits} of active.values())colliders.push(...hits);
 }
 function locate(pos){
   let best=Math.max(0,index),dist=Infinity,t=0;
   for(let i=Math.max(0,index-2);i<Math.min(plan.cells.length,index+4);i++){
     const p=plan.cells[i],v=Math.max(0,Math.min(32,(pos.x-p.x)*p.dx+(pos.z-p.z)*p.dz));
     const d=Math.hypot(pos.x-p.x-v*p.dx,pos.z-p.z-v*p.dz);
     if(d<dist){best=i;dist=d;t=v;}
   }
   sync(best);return best+t/32;
 }
 return {sync,locate,colliders,get index(){return index;},get near(){return segments.slice(Math.max(0,index-1),index+3);},active};
}
