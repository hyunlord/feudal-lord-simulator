// Packaging and validation only. No artwork is altered.
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const sharp=require('/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js');
const root=path.resolve(__dirname,'..');
const staging='/tmp/astra-wave41-expanded-20261002';
const archive='/tmp/astra-wave41-expanded-20261002-lite.zip';
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
(async()=>{
 if(fs.existsSync(staging)||fs.existsSync(archive))throw Error('Refuse to overwrite existing delivery');
 const extras=walk(path.join(root,'assets')).filter(f=>f.endsWith('.png'));
 if(extras.length!==6)throw Error('Expected6 additions');
 fs.mkdirSync(staging);
 cp.execFileSync('unzip',['-q','/tmp/astra-wave41-candidates-20261002-lite.zip','-d',staging]);
 fs.renameSync(path.join(staging,'astra-wave41-candidates-20261002'),path.join(staging,'base29'));
 const additions=path.join(staging,'additions6');fs.mkdirSync(additions);
 for(const d of ['assets','proofs','records'])fs.cpSync(path.join(root,d),path.join(additions,d),{recursive:true});
 for(const f of ['README.md','QA.md'])fs.copyFileSync(path.join(root,f),path.join(additions,f));
 fs.writeFileSync(path.join(staging,'README.md'),'# Wave41 통합 후보35개\n\n기존 아트 감사 재작업29개(base29)와 추가6개(additions6)를 한 ZIP으로 묶었다. 기존29 파일은 이전 ZIP의 바이트 그대로 보존했다. 기존29의 시각검수는 동봉된 원래 QA 기록을 계승하며, 이번에 새로 제작·검수한 대상은 추가6개다.\n\n추가6개: 숲바닥↔풀밭 전이띠 여름·겨울2장(512×64,X반복), 폭1 여울 NE/NW×여름/겨울4장(512×256). 바이블v2 기준, candidate, 게임미설치.\n\n각 폴더의 README/QA/records에서 프롬프트·출처·규격·반복·계절 대응 검수를 확인할 수 있다. 프루프는 오프라인 합성이다. 런타임 접합·DPR·성능 검증은 포함하지 않는다. 생성원본은 작업폴더 raw에 보존하고 ZIP에서는 제외했다.\n');
 const rows=[];for(const p of walk(staging).filter(f=>f.includes('/assets/')&&f.endsWith('.png'))){const m=await sharp(p).metadata();rows.push({id:path.basename(p,'.png'),file:path.relative(staging,p),width:m.width,height:m.height,sha256:sha(p),status:'candidate'});}
 if(rows.length!==35||new Set(rows.map(r=>r.id)).size!==35)throw Error('35 unique assets required');
 fs.writeFileSync(path.join(staging,'assets.csv'),'id,file,width,height,sha256,status\n'+rows.map(r=>Object.values(r).join(',')).join('\n')+'\n');
 fs.writeFileSync(path.join(staging,'DELIVERY_VALIDATION.json'),JSON.stringify({assets:35,base:29,additions:6,unique_ids:35,original_zip_sha256:sha('/tmp/astra-wave41-candidates-20261002-lite.zip'),runtime_verified:false},null,2));
 fs.writeFileSync(path.join(staging,'SHA256SUMS.txt'),walk(staging).sort().map(p=>sha(p)+'  '+path.relative(staging,p)).join('\n')+'\n');
 cp.execFileSync('zip',['-q','-r','-9',archive,path.basename(staging)],{cwd:'/tmp'});
 cp.execFileSync('unzip',['-tq',archive]);
 console.log(JSON.stringify({archive,bytes:fs.statSync(archive).size,sha256:sha(archive),assets:rows.length},null,2));
})();
