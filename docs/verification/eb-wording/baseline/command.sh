set -euo pipefail
[ "$(uname -s)" = Linux ]
[ "$(node --version)" = v24.21.0 ]
[ -z "$(git status --porcelain)" ]
mkdir -p .remote/eb-words-browser
node --input-type=module <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const original=resolve('scripts/eventArtAutoCapture.mjs');
const bytes=readFileSync(original); const hash=b=>createHash('sha256').update(b).digest('hex');
if(hash(bytes)!=='26c35e17ccd99e4662ec1a83a112360ebe15dcd7ed49de6e31dff9cf8febff4f') throw Error('capture source hash drift');
let source=bytes.toString();
const anchor='    const why = shown.entry !== id ?';
if(source.split(anchor).length!==2) throw Error('capture anchor changed');
const addition=`    const expectedChoice = id === 'ck_evt_005' ? ['a', '시장 좌판세 배율을 750‰로 낮춘다'] : ['light', '시장 좌판세 배율을650‰로 낮춘다'];
    const heading = page.locator(CARD + '[data-registry-offer="' + id + '"] .decision-card-choice[data-choice="' + expectedChoice[0] + '"] h3');
    if (await heading.count() !== 1) throw Error('exact choice heading missing or duplicate');
    await heading.scrollIntoViewIfNeeded();
    const wording = await heading.evaluate(el => { const r=el.getBoundingClientRect(); const s=getComputedStyle(el); const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return {text:el.textContent,box:{x:r.x,y:r.y,width:r.width,height:r.height},fontSize:s.fontSize,visible:s.visibility==='visible' && s.display!=='none' && r.width>0 && r.height>0 && r.x>=0 && r.y>=0 && r.right<=innerWidth && r.bottom<=innerHeight && (top===el || el.contains(top))}; });
    if(wording.text !== expectedChoice[1] || !wording.visible) throw Error('wording mismatch or obscured: '+JSON.stringify(wording));
    await page.screenshot({path:join(out,'wording-'+id+'.png')});
    shown.wording = {...wording,choiceId:expectedChoice[0],preparedOccurrenceFixture:true};
`;
source=source.replace(anchor,addition+anchor);
const ret='return { ...expected, bound, ok: why === null, why, natural: shown.natural';
if(source.split(ret).length!==2) throw Error('return anchor changed');
source=source.replace(ret,'return { ...expected, wording: shown.wording, bound, ok: why === null, why, natural: shown.natural');
source=source.replace(/from '(\.\.?\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,pathToFileURL(original)).href));
writeFileSync('.remote/eb-words-browser/capture.mjs',source,{flag:'wx'});
writeFileSync('.remote/eb-words-browser/provenance.json',JSON.stringify({sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),originalScriptSha256:hash(bytes),helperSha256:hash(source),scope:'Two prepared occurrence fixtures through the real registry card. Text rendering only; not natural reachability or answer consequences.'},null,2)+'\n',{flag:'wx'});
JS
port=${FLS_REMOTE_PORT:?}
. scripts/remote/devServers.sh
fls_serve .remote/eb-words-browser/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" >/dev/null && break; sleep 1; done
curl -sf "$url" >/dev/null
node_modules/.bin/tsx .remote/eb-words-browser/capture.mjs .remote/eb-words-browser --url "$url" --only ck_evt_005,ck_evt_042 --jobs 1
node --input-type=module <<'JS'
import {readFileSync} from 'node:fs';
const r=JSON.parse(readFileSync('.remote/eb-words-browser/captures.json','utf8'));
if(r.shipped.join(',')!=='ck_evt_005,ck_evt_042'||Object.values(r.pictures).some(x=>!x.ok||!x.wording?.visible))throw Error('incomplete wording evidence');
JS
