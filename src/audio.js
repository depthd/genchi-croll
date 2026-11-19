export function atmosphere(ctx,volume){
 const compressor=ctx.createDynamicsCompressor(),master=ctx.createGain();
 compressor.connect(master).connect(ctx.destination);master.gain.value=volume;
 const data=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),samples=data.getChannelData(0);
 for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*.3;
 const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),level=ctx.createGain();
 noise.buffer=data;noise.loop=true;filter.type='lowpass';filter.frequency.value=1100;
 level.gain.value=.095;noise.connect(filter).connect(level).connect(compressor);noise.start();
 const hum=ctx.createOscillator(),humGain=ctx.createGain();hum.frequency.value=54;
 humGain.gain.value=.018;hum.connect(humGain).connect(compressor);hum.start();
 function pulse(freq,amp,length,wave='sine'){
   const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();o.type=wave;
   o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*.27),t+length);
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(amp,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+length);
   o.connect(g).connect(compressor);o.start(t);o.stop(t+length+.01);
 }
 return {input:compressor,volume(v){master.gain.setTargetAtTime(v,ctx.currentTime,.025);},
  ambience(inside){filter.frequency.setTargetAtTime(inside?400:1300,ctx.currentTime,.4);},
  step(y){pulse(y>2?290:y<0?92:122,.05,.08);},tick(){pulse(660,.026,.045,'triangle');},
  transfer(){pulse(740,.11,1.4,'sawtooth');},shot(){pulse(88,.32,.26);}
 };
}
