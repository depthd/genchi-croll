import {rng} from './route.js';
import {templates,buildSegment,compatible,layers} from './segments.js';
export function sequence(plan){
 const result=[];
 for(const c of plan.cells){
   const random=rng(plan.seed^Math.imul(c.i+1,2654435761));
   const recent=result.slice(-5).map(s=>s.id), progress=c.i/plan.cells.length;
   const choices=templates.filter(t=>!recent.includes(t.id)&&t.minProgress<=progress);
   const weight=t=>t.weight*(1+t.threat*progress);
   let ticket=random()*choices.reduce((n,t)=>n+weight(t),0);
   const chosen=choices.find(t=>(ticket-=weight(t))<0)??choices.at(-1);
   const s=buildSegment(plan,c.i,chosen);
   if(c.i&&!layers.every(k=>compatible(result.at(-1).exit[k],s.entry[k])))throw Error('Несовместимый порт '+c.i);
   result.push(s);
 }
 return result;
}
