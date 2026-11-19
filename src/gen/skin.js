import * as T from 'three';
import {surface} from '../surfaces.js';
import {rng} from './route.js';
import {mix} from './segments.js';
const kinds=['tile','brick','cement','steel','shutter','asphalt','crate','bin','stripe','check','poster','sign','graffiti'];
let material;
const tiles=new Map();
export function atlas(){
 if(material)return material;
 const canvas=(typeof document==='undefined'?new OffscreenCanvas(512,512):document.createElement('canvas'));canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d');
 for(const kind of kinds)for(let v=0;v<3;v++){
   const i=tiles.size;tiles.set(kind+v,i);
   ctx.drawImage(surface(kind,v).map.image,(i%8)*64,Math.floor(i/8)*64);
 }
 for(const [i,text] of ['ЛАПША','РЕМОНТ','СЕКТОР 01','ПОЛИЦИЯ','СИГНАЛ','ЗАПЧАСТИ'].entries()){
   const n=tiles.size,x=n%8*64,y=Math.floor(n/8)*64;tiles.set('label'+i,n);ctx.fillStyle='#532c30';ctx.fillRect(x,y,64,64);
   ctx.strokeStyle='#ff9a3c';ctx.strokeRect(x+2,y+5,60,54);ctx.fillStyle='#ffbc76';ctx.textAlign='center';ctx.font='bold 14px monospace';ctx.fillText(text,x+32,y+34,59);
   ctx.fillRect(x+10,y+43,44,1);
 }
 const n=tiles.size;tiles.set('plain',n);ctx.fillStyle='#ffffff';ctx.fillRect(n%8*64,Math.floor(n/8)*64,64,64);
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.minFilter=map.magFilter=T.NearestFilter;map.generateMipmaps=false;
 material=new T.MeshBasicMaterial({map,vertexColors:true,side:T.DoubleSide});
 material.onBeforeCompile=shader=>{
   shader.vertexShader='attribute float tile;varying float vTile;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvTile=tile;');
   shader.fragmentShader='varying float vTile;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
     vec2 cell=vec2(mod(vTile,8.),7.-floor(vTile/8.));
     diffuseColor*=texture2D(map,(cell+(fract(vMapUv)*63.+.5)/64.)/8.);
   `);
 };
 return material;
}
const faces=[
 [[0,1,3,2],0,1,.72],[[5,4,6,7],0,1,.9],[[4,0,2,6],2,1,.74],
 [[1,5,7,3],2,1,.9],[[2,3,7,6],0,2,1],[[4,5,1,0],0,2,.54]
];
const colorCache=new Map();
function batch(group){
 const mat=atlas(),pos=[],uv=[],color=[],tile=[],idx=[],shade=new T.Color();
 function face(points,w,h,kind,tint,brightness=1){
   const base=pos.length/3;shade.set(tint).multiplyScalar(brightness);
   for(const [i,p] of points.entries()){
     pos.push(p.x,p.y,p.z);color.push(shade.r,shade.g,shade.b);tile.push(tiles.get(kind)??tiles.get('plain'));uv.push(i===1||i===2?w:0,i>=2?h:0);
   }
   idx.push(base,base+1,base+2,base,base+2,base+3);
 }
 function box(x,y,z,w,h,d,kind,tint='#f0e1d0',label=false){
   if(!colorCache.has(tint))colorCache.set(tint,new T.Color(tint));
   const rgb=colorCache.get(tint),dims=[w,h,d],n=tiles.get(kind)??tiles.get('plain');
   for(const [indices,horizontal,vertical,light] of faces){
     const base=pos.length/3,uw=label?.998:dims[horizontal]/4,vh=label?.998:dims[vertical]/4;
     for(let j=0;j<4;j++){
       const i=indices[j];
       pos.push(x+((i&1)?w:-w)/2,y+((i&2)?h:-h)/2,z+((i&4)?d:-d)/2);
       color.push(rgb.r*light,rgb.g*light,rgb.b*light);tile.push(n);uv.push(j===1||j===2?uw:0,j>=2?vh:0);
     }
     idx.push(base,base+1,base+2,base,base+2,base+3);
   }
 }
 function finish(){
   const g=new T.BufferGeometry();
   for(const [key,values,size] of [['position',pos,3],['uv',uv,2],['color',color,3],['tile',tile,1]])g.setAttribute(key,new T.Float32BufferAttribute(values,size));
   g.setIndex(idx);g.computeBoundingSphere();const mesh=new T.Mesh(g,mat);mesh.userData.owned=true;group.add(mesh);
 }
 return {face,box,finish};
}
export function skin(plan){
 atlas();
 return (group,s,hits)=>{
  const rnd=rng(plan.seed^Math.imul(s.i+3,0x45d9f3b)),c=plan.cells[s.i],v=s.i%3;
  const {face,box,finish}=batch(group);
  const place=(u,y,t,w,h,d,k,tint,label=false)=>box(c.x-c.dz*u+c.dx*t,y,c.z+c.dx*u+c.dz*t,c.dx?d:w,h,c.dx?w:d,k,tint,label);
  for(const mesh of [...group.children]){
    const p=mesh.userData.slab;
    if(p){const ox=-p.dz*p.w/2,oz=p.dx*p.w/2;
      face([[p.a,1],[p.a,-1],[p.b,-1],[p.b,1]].map(([q,n])=>({x:q.x+n*ox,y:q.y,z:q.z+n*oz})),p.w/4,p.length/4,(p.link?'steel':{G:'asphalt',R:'cement',I:'tile',U:'steel'}[p.layer])+v,'#c5bcaf');
      if(p.link)for(let j=1;j<p.length;j+=1.25){
        const q=mix(p.a,p.b,j/p.length);box(q.x+ox,q.y+.06,q.z+oz,.10,.12,.19,'plain','#4fe7ff');
      }
    }
    mesh.visible=false;
  }
  if(!group.children.length)throw Error('Пустой каркас '+s.i);
  const b=s.cover;
  box(b.x,.51,b.z,b.w,1.02,b.d,'bin'+v);box(b.x,1.05,b.z,1.07,.09,1.08,'stripe'+v);
  for(const side of [-1,1]){
    const edge=side<0?-11:14;
    const floors=3+Math.floor(rnd()*4);
    // Short frontage ends before a bend, leaving room for the inside lane.
    for(let bay=0;bay<4;bay++){
      const t=5+bay*7,wide=6.85,high=(floors+(bay===2?1:0))*3.2;
      place(edge+side*2.2,high/2-1,t,4.3,high+2,wide,(bay%2?'brick':'cement')+v);
      place(edge-side*.08,1.55,t,.16,3.1,wide-.3,'shutter'+v);
      for(let row=0;row<floors-1;row++)for(let win=0;win<2;win++){
        const y=4.4+row*3.2,z=t+(win?1.55:-1.55);
        place(edge-side*.12,y,z,.2,1.55,1.9,'steel'+v);
        place(edge-side*.25,y,z,.08,1.28,1.62,'plain',rnd()<.21?'#ce864c':'#31384d');
        place(edge-side*.31,y,z,.06,1.32,.09,'plain','#252938');
      }
      place(edge-side*.3,3.18,t,.6,.17,wide,'steel'+v);
      if(bay%2===0){place(edge-side*.45,4.1,t-2,.8,.7,.85,'shutter'+v);place(edge-side*.48,2,t+2,.18,4,.18,'steel'+v);}
    }
  }
  // Street-level shop fronts stay outside the two-metre running strip.
  const t=5+Math.floor(rnd()*5);
  place(-3.65,1.6,t,.5,3.2,5,'tile'+v);place(-3.33,1.35,t,.12,2.4,3.6,'shutter'+v);
  place(-3.1,3.1,t,.9,.16,5,'plain','#803332');
  place(-3.05,3.85,t,.17,.95,3.7,'label'+(s.i%6),'#ffd6a0',true);
  for(let j=0;j<3;j++)place(-3.15,2.6,t-1.6+j*1.45,.23,.47,.25,'plain','#ff9a3c');
  for(let j=0;j<8;j++)place(-2.96,.8+j*.14,t+2,.15,.14,.15,'plain',j%2?'#b9ab8c':'#ff3b3b');
  place(-2.95,1.1,t-2,.1,.8,.63,'poster'+v);
  for(let j=0;j<18;j++)place(-1.65+rnd()*.8,.009,t+(rnd()-.5)*5,.08+rnd()*.24,.01,.08+rnd()*.35,'plain','#785035');
  for(const layer of ['I','U']){
    const a=s.entry[layer],b=s.exit[layer],w=a.w/2;
    for(const t of [.18,.42,.66,.9]){
      const p=mix(a,b,t);
      const bx=p.x-c.dz*(w+.35),bz=p.z+c.dx*(w+.35);
      box(bx,p.y+1.5,bz,c.dx?2:.25,3,c.dx?.25:2,(layer==='I'?'tile':'steel')+v);
      box(bx,p.y+2.67,bz,c.dx?.75:.32,.1,c.dx?.32:.75,'plain',layer==='I'?'#ff9a3c':'#4fe7ff');
      box(p.x,p.y+3.18,p.z,c.dx?2.3:a.w, .12,c.dx?a.w:2.3,'steel'+v);
    }
  }
  for(const layer of ['R','I','G','U']){
    const a=s.entry[layer],b=s.exit[layer],w=a.w/2;
    // Give slabs a visible edge and foundations down to the storm drain.
    for(const side of [-1,1]){
      const n=side*w;
      const edge=q=>({x:q.x-c.dz*n,y:q.y,z:q.z+c.dx*n});
      const near=edge(a),far=edge(b);
      const base=q=>({...q,y:Math.min(-5.4,q.y-.18)});
      for(const [lo,hi] of [[.02,.10],[.44,.49],[.94,.98]]){
        const l=mix(near,far,lo),r=mix(near,far,hi);
        face([l,r,base(r),base(l)],1,2,(layer==='I'?'brick':'cement')+v,'#6e6558');
      }
    }
  }
  if(s.template.street==='market')for(let j=0;j<4;j++)
    place(3.35+.55*(j%2),.32+Math.floor(j/2)*.57,16+j%2,.58,.58,.68,'crate'+j%3);
  if(s.template.street==='barricade')place(-2.75,.6,16,.42,1.2,2.2,'stripe'+v);
  if(s.template.room==='kitchen'){const p=mix(s.entry.I,s.exit.I,.66);
    box(p.x-c.dz*1.37,p.y+.54,p.z+c.dx*1.37,.42,1.08,.65,'shutter'+v);}
  if(s.template.roof==='skylight'){const p=mix(s.entry.R,s.exit.R,.6);
    box(p.x+c.dz*1.9,p.y+.13,p.z-c.dx*1.9,.9,.26,1.7,'tile'+v);}
  if(s.template.drain==='water'){const p=mix(s.entry.U,s.exit.U,.55);
    box(p.x,p.y+.01,p.z,c.dx?4.6:2,.01,c.dx?2:4.6,'plain','#28484b');}
  for(let j=0;j<3;j++){
    const y=6.5+j*.29,t=11+j*2.35;
    place(0,y,t,19,.035,.045,'plain','#242738');
  }
  if(s.i%4===2){
    place(0,6.4,22,17,.45,2.3,'steel'+v);
    place(0,6.12,20.97,12,.05,.12,'plain','#aa346b');
    place(0,7.25,21.04,17,.13,.14,'steel'+v);
    for(let k=-8;k<=8;k+=2)place(k,6.9,21.04,.08,.9,.12,'steel'+v);
  }
  if(s.i===0){
    place(0,-.04,2,5,.08,4,'check0');place(0,2.9,.3,5,.18,1.3,'tile2');
    place(-2.35,1.2,1.8,.2,2.4,4,'tile1');
    place(2.28,1.3,1.5,.2,2.6,3,'shutter1');
    place(1.68,.82,2.2,.92,.18,2,'crate1');
    for(const t of [1.5,2.9])place(1.8,.4,t,.12,.8,.12,'steel0');
    place(1.65,1.15,2,.22,.4,.2,'steel2');
    place(1.54,1.21,2.55,.12,.1,.38,'steel1');
    place(-1.75,.5,1,.78,1,1.7,'steel0');place(-2.04,1.2,1,.12,1.4,1.62,'tile2');
    place(-1.77,1.09,1,.32,.18,.8,'steel1');place(-1.77,1.13,1.6,.24,.24,.23,'cement0');
    place(-1.8,2.27,1.6,.52,.08,.52,'plain','#7dff1a');
  }
  const r=mix(s.entry.R,s.exit.R,.32);
  box(r.x+c.dz*2,r.y+.6,r.z-c.dx*2,1.1,1.2,1.1,'steel'+v);
  if(s.jumps.length){const p=s.jumps[0].b;box(p.x,p.y+.015,p.z,c.dx?.12:2.8,.03,c.dx?2.8:.12,'stripe'+v);}
  if(plan.relays.includes(s.i)||s.i===plan.cells.length-1){
    place(-2,3,2,.35,6,.35,'steel'+v);place(-2,5.6,2,.55,.85,.55,'plain','#7dff1a');
  }
  finish();
 };
}
export function skyline(scene,plan){
 const group=new T.Group(),{box,finish}=batch(group);
 for(const p of plan.cells.filter(c=>c.i%3===0)){
   for(const sign of [-1,1]){const n=22+(p.i%4)*7;box(p.x-sign*p.dz*40,n/2,p.z+sign*p.dx*40,17,n,20,'cement1','#363d59');}
 }
 finish();scene.add(group);
 const tower=new T.Group(),b=batch(tower);
 for(const [w,y,h] of [[30,21,42],[22,59,35],[13,87,24],[4,105,14]])b.box(0,y,0,w,h,w,'steel2','#303954');
 for(let y=25;y<100;y+=9)b.box(0,y,0,4,.8,25,'plain',y%2?'#4fe7ff':'#ff3b3b');
 b.finish();scene.add(tower);tower.children[0].material=tower.children[0].material.clone();
 tower.children[0].material.onBeforeCompile=material.onBeforeCompile;tower.children[0].material.fog=false;
 return pos=>{const dx=plan.tower.x-pos.x,dz=plan.tower.z-pos.z,dist=Math.hypot(dx,dz),f=80/dist;
   tower.position.set(pos.x+dx*f,0,pos.z+dz*f);tower.scale.setScalar(Math.min(1,f*3));};
}
