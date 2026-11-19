import {query} from './config.js';
const key='genchi-campaign-v1';
const fresh=()=>({seed:crypto.getRandomValues(new Uint32Array(1))[0], attempts:0,relay:0,record:0,best:null});
let stored;
try {stored=JSON.parse(localStorage.getItem(key));}catch{}
export const campaign=Number.isInteger(stored?.seed)?Object.assign(fresh(),stored):fresh();
if(query.has('seed')&&Number.isInteger(Number(query.get('seed')))&&campaign.seed!==(Number(query.get('seed'))>>>0))
  Object.assign(campaign,fresh(),{seed:Number(query.get('seed'))>>>0});
export function save(){try{localStorage.setItem(key,JSON.stringify(campaign));}catch{}}
export function restartCampaign(){Object.assign(campaign,fresh());save();location.replace(location.pathname);}
save();
