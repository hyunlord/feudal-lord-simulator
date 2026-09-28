const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const base=path.resolve(__dirname,'..'),old=path.resolve(base,'../astra-lineage-prod1-v1');
const core=['101','102','201','202','203','204','301','302','303','304'];
const families=['L3','L4','L5'];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function file(id){const rel=`assets/${id.slice(0,2)}/${id}.png`;return fs.existsSync(path.join(base,rel))?path.join(base,rel):path.join(old,rel);}
function board(w,h){const c=createCanvas(w,h),g=c.getContext('2d');g.fillStyle='#e8e5dd';g.fillRect(0,0,w,h);return {c,g};}
function label(g,s,x,y,size=16){g.fillStyle='#29261f';g.font=`${size}px sans-serif`;g.fillText(s,x,y);}
function save(c,p){fs.writeFileSync(path.join(base,p),c.toBuffer('image/png'));}
(async()=>{
 const images=new Map();
 for(const f of families)for(const n of core){const id=`${f}_${n}_young`;images.set(id,await loadImage(file(id)));}
 const {c,g}=board(1664,666);
 label(g,'Three families: founders at left, then children and grandchildren. Portraits 144 px.',20,28,20);
 families.forEach((f,r)=>{label(g,`${f} ${['Gentry','Merchant','Reeve'][r]}`,20,66+r*196,20);core.forEach((n,i)=>{const id=`${f}_${n}_young`,x=20+i*164,y=78+r*196;g.drawImage(images.get(id),x,y,144,144);label(g,id,x,y+164,13);});});
 save(c,'proofs/01-three-families.png');
 const items=families.flatMap(f=>core.map(n=>({id:`${f}_${n}_young`,family:f})));
 let seed=92824;for(let i=items.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[items[i],items[j]]=[items[j],items[i]];}
 const b=board(1584,650);
 items.forEach((a,i)=>{const x=12+i%6*262,y=12+Math.floor(i/6)*128;label(b.g,String(i+1),x,y+18,17);b.g.drawImage(images.get(a.id),0,180,256,76,x,y+28,256,76);a.number=i+1;a.sourceSHA256=hash(file(a.id));});
 save(b.c,'proofs/02-clothes-only-blind.png');
 fs.writeFileSync(path.join(base,'records/clothes-key.json'),JSON.stringify({crop:[0,180,256,76],note:'Offline proof crop only; final portraits unchanged. Heads/faces omitted; no hat cue.',items},null,2));
 const m=board(1152,748);
 label(m.g,'Mothers: old L4 / new L4 / old L5 / new L5. Young, mature, old.',20,28,19);
 for(const [r,s]of ['young','mature','old'].entries())for(const [col,f,newer]of [[0,'L4',false],[1,'L4',true],[2,'L5',false],[3,'L5',true]]){const id=`${f}_102_${s}`,p=newer?file(id):path.join(old,`assets/${f}/${id}.png`);m.g.drawImage(await loadImage(p),20+col*284,48+r*232,208,208);label(m.g,`${newer?'new':'old'} ${id}`,20+col*284,272+r*232,14);}
 save(m.c,'proofs/03-mothers-before-after.png');
 const ids=fs.readdirSync(path.join(base,'assets/L4')).filter(x=>x.endsWith('.png')).sort();
 const a=board(1392,Math.ceil(ids.length/6)*142+44);
 label(a.g,'L4 original / revised at 96 px; source portraits are unchanged.',16,26,19);
 for(const [i,n]of ids.entries()){const x=16+i%6*230,y=44+Math.floor(i/6)*142;a.g.drawImage(await loadImage(path.join(old,'assets/L4',n)),x,y,96,96);a.g.drawImage(await loadImage(path.join(base,'assets/L4',n)),x+100,y,96,96);label(a.g,n.replace('.png',''),x,y+116,13);}
 save(a.c,'proofs/04-L4-before-after96.png');
 console.log('Proofs written with source hashes.');
})();
