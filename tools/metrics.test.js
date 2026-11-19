import assert from 'node:assert/strict';
import {canTraverse} from '../src/config.js';
const a={x:0,y:0,z:0};
for(const [x,y,kind,expected] of [[3.4,0,'gap',true],[3.41,0,'gap',false],[1,.81,'gap',false],[2,-6.1,'gap',false],[3.8,-1,'gap',true],[0,1.31,'vault',false],[8,4,'ramp',true],[2,2,'ramp',false],[NaN,0,'gap',false]])assert.equal(canTraverse(a,{x,y,z:0},kind),expected);
