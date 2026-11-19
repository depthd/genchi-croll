import * as T from 'three';
import {skin} from './skin.js';
let decorate;
self.onmessage=({data})=>{
 if(data.plan){decorate=skin(data.plan);return;}
 const {id,segment}=data;
 const group=new T.Group();
 for(const slab of segment.slabs){const o=new T.Object3D();o.userData.slab=slab;group.add(o);}
 decorate(group,segment,[]);
 const geom=group.children.at(-1).geometry,attributes={};
 for(const [key,a] of Object.entries(geom.attributes))attributes[key]={array:a.array,size:a.itemSize};
 const index=geom.index.array;
 self.postMessage({id,index,attributes},[index.buffer,...Object.values(attributes).map(a=>a.array.buffer)]);
};
