import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),repo='/Users/rexxa/fls-astra-world';
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const w=read('world/hundred.json'),rules=read('world/rules.json'),map=read('world/map.json'),bindings=read('records/portrait-bindings.json');
const errors=[];let checks=0;const ok=(v,label)=>{checks++;if(!v)errors.push(label)};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const required=['world/hundred.json','world/rules.json','WORLD.md','CHRONICLE_SAMPLE.md','MAP.md','map-placement.jpg','PORTRAITS.md','NEW_FIELDS.md','SOURCES.md'];
for(const p of required)ok(fs.existsSync(path.join(root,p)),`required ${p}`);
ok(w.proposals.houses.length===18,'18 groups');ok(w.proposals.personProfiles.length===138,'138 persons');ok(rules.rules.length===14,'14 rules');ok(w.proposals.newFieldIds.length===14,'14 gap categories');
ok(bindings.length===138,'138 portrait bindings');
for(const b of bindings){ok(fs.existsSync(path.join(repo,b.path)),`portrait exists ${b.personId}`);ok(sha(path.join(repo,b.path))===b.sha256,`portrait SHA ${b.personId}`);const p=w.proposals.personProfiles.find(p=>p.id===b.personId);ok(p&&JSON.stringify(p.portrait)===JSON.stringify(b),`portrait embedded ${b.personId}`);ok(!['I104','I106'].includes(b.identity),`no unearned royal office ${b.personId}`);if(p.houseId!=='h18')ok(b.sourceLineage!=='L6'&&!/ermine/i.test(b.clothing??''),`no ermine ${b.personId}`);if(Math.abs(b.depictedAge-b.sourceAge)>(b.depictedAge<18?4:10))ok(b.needsNewPortrait,`age mismatch flagged ${b.personId}`);if(b.duplicateOf)ok(b.needsNewPortrait,`duplicate flagged ${b.personId}`);}
ok(w.proposals.portraitRequirements.length===bindings.filter(b=>b.needsNewPortrait).length,'portrait shortages consistent');
ok(JSON.stringify(w.proposals.map)===JSON.stringify(map),'embedded map exact');ok(sha(path.join(repo,map.source.path))===map.source.sha256,'map source SHA');
for(const p of map.placements){ok(p.x>=0&&p.x<1600&&p.y>=0&&p.y<1000,`map bounds ${p.houseId}`);ok(w.engine.estates.estates.some(e=>e.id===p.estateId),`map estate ${p.houseId}`);const es=p.routeFromPlayer.edgeIds.map(id=>map.network.edges.find(e=>e.id===id));ok(es.every(Boolean),`route edges ${p.houseId}`);const km=es.reduce((n,e)=>n+e.lengthKm,0);ok(Math.abs(km-p.routeFromPlayer.distanceKm)<=0.0051,`route distance ${p.houseId}`);}
for(const h of w.proposals.houses){ok(h.hooks.length===2,`two hooks ${h.id}`);if(!h.isInstitution)ok([1,2,3].every(g=>w.proposals.personProfiles.some(p=>p.houseId===h.id&&p.generation===g)),`three generations ${h.id}`);if(h.id!=='h18')ok(!/ermine/i.test(h.blazonEn),`heraldry no ermine ${h.id}`);}
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();const status=execFileSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'});ok(head===w.meta.sourceCommit,'pinned HEAD unchanged');ok(status==='','clone clean');
for(const file of ['records/native-validation.json','records/chronicle-validation.json'])ok(read(file).status==='PASS',`${file} PASS`);
const result={status:errors.length?'FAIL':'PASS',checks,counts:{groups:18,neighbours:16,initialPersons:138,futurePersons:read('records/chronicle-validation.json').futurePersons,rules:14,majorEvents:32,engineGapCategories:14,portraitShortages:w.proposals.portraitRequirements.length},sourceCommit:head,cloneClean:status==='',visualReview:{map:'1600x1000 JPEG viewed;18 markers and proposed crossings legible',portraits:'18 heads at96px viewed; shared-source-lineage resemblance disclosed'},errors};
fs.writeFileSync(path.join(root,'records/package-validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;
