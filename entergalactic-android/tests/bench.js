const C=require('../web/eg-core.js'),E=require('../web/eg-filters.js'),S=require('../web/schema.json');
const byId={};S.filters.forEach(f=>byId[f.id]=f);
const w=1000,h=666,a=C.img(w,h,3);for(let i=0;i<a.d.length;i++)a.d[i]=(Math.sin(i*0.001)+1)/2*0.8+0.1*((i*7919)%13)/13;
const res=[];
for(const f of S.filters){const ctx=new C.Context(h,w,0.25,[0,0,1,1],1,[4000,2666]);const t=Date.now();E.runStack(C.clone(a),{stack:[{id:f.id}]},ctx,byId);res.push([Date.now()-t,f.id]);}
res.sort((x,y)=>y[0]-x[0]);console.log(res.slice(0,14).map(r=>r[1]+' '+r[0]+'ms').join('\n'));
let tot=0;for(const p of S.presets){const ctx=new C.Context(h,w,0.25,[0,0,1,1],1,[4000,2666]);const t=Date.now();E.runStack(C.clone(a),p,ctx,byId);tot+=Date.now()-t;}
console.log('media por receta (1000px):',Math.round(tot/S.presets.length),'ms');
