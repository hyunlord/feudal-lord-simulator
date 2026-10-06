import { advanceCity, createCity, policyPreset, setPolicy, type City, type Terrain } from '../model/index.js';
import { createSession, dispatch, sessionContext, encodeRecording, decodeRecording, type SessionCommand } from '../model/session.js';
import { button, element, section } from './dom.js';
import { policyView, resourceView, townView } from './views.js';
import { cityMap } from './map.js';
import { encountersView } from './encounters.js';
import { sessionMessage } from './contract-copy.js';
const root = document.getElementById('app');
if (!root) throw new TypeError('Missing application root');
const app: HTMLElement = root;
let session = createSession(1, 'river');
let page: 'town' | 'policy' | 'compare' | 'neighbor' = 'policy';
let timer: ReturnType<typeof setInterval> | undefined;
let compared: readonly City[] = [];
let eveningMap = false;
const status = element('p', '', 'message');status.setAttribute('role', 'status');
function pause(): void {if(timer!==undefined)clearInterval(timer);timer=undefined;}
function act(command:SessionCommand):boolean {const ok=dispatch(session,command);status.textContent=sessionMessage(session.message);return ok;}
function start(): void {
 pause();timer=setInterval(()=>{if(session.player.tick>=144){pause();status.textContent='144일 성장 기록입니다.';}else act({kind:'advance',steps:1});render();},160);render();
}
function navigate(next: typeof page): void {pause();page=next;render();}
function compare(): void {
 pause();compared=(['agriculture','craft','military'] as const).map(axis=>{const sample=createCity(session.seed,session.terrain);setPolicy(sample,policyPreset(axis));return sample;});
 page='compare';render();timer=setInterval(()=>{for(const sample of compared)advanceCity(sample,4);if(compared.every(sample=>sample.tick>=144))pause();render();},40);
}
function terrainPicker(): HTMLElement {
 const label=element('label','시작 지형 ','inline-label'),select=element('select');select.setAttribute('aria-label','시작 지형');
 const terrains:readonly(readonly[Terrain,string])[]=[['river','강가'],['coast','해안'],['mountain','산'],['forest','숲'],['marsh','습지']];
 for(const [value,title]of terrains){const option=element('option',title);option.value=value;option.selected=session.terrain===value;select.append(option);}
 select.addEventListener('change',()=>{const chosen=terrains.find(([value])=>value===select.value);if(!chosen)return;pause();session=createSession(1,chosen[0]);page='policy';status.textContent='같은 시작 재고로 새 지형을 준비했습니다.';render();});label.append(select);return label;
}
async function save():Promise<void>{
 pause();try{localStorage.setItem('estates-recording',await encodeRecording(session));status.textContent='이 브라우저에 명령 기록을 저장했습니다.';}
 catch(error){if(!(error instanceof Error))throw error;status.textContent=`저장하지 못했습니다: ${error.message}`;}render();
}
async function restore():Promise<void>{
 pause();try{const text=localStorage.getItem('estates-recording');if(!text){status.textContent='저장된 기록이 없습니다.';return;}session=await decodeRecording(text);page='town';status.textContent='기록을 재현하고 결과 해시를 확인했습니다.';}
 catch(error){if(!(error instanceof Error))throw error;status.textContent=`기록을 불러오지 못했습니다: ${error.message}`;}finally{render();}
}
function render():void{
 app.className=page==='compare'?'compare':eveningMap?'evening-map':'';app.replaceChildren();
 const header=element('header');header.append(element('p','조건을 만들면, 주민이 도시를 만듭니다','eyebrow'),element('h1','저마다의 영지'),element('p','로컬 탐사 시제품 · 시간 압축 · 같은 seed 1','note'));app.append(header);
 if(page==='policy'){
  app.append(terrainPicker(),policyView(session.player,policy=>act({kind:'policy',policy})),button('영지로 가기',()=>navigate('town'),true));
 }else if(page==='town'){
  const controls=element('div','','actions');controls.append(button(timer===undefined?'성장 보기':'일시정지',()=>{if(timer===undefined)start();else{pause();render();}},true),button('12일 진행',()=>{pause();act({kind:'advance',steps:12});render();}));
  app.append(controls,button('이웃과 교역·전투',()=>navigate('neighbor')),townView(session.player),button('같은 시작, 세 방향 비교',compare));
 }else if(page==='neighbor'){
  app.append(encountersView({player:session.player,neighbor:session.neighbor,context:sessionContext(session),result:session.battle,offer:()=>{act({kind:'offer'});render();},advance:()=>{act({kind:'advance',steps:1});render();},battle:(command,defending)=>{
   act({kind:'battle',mode:command.mode,entry:command.entry,defending});render();const result=document.getElementById('battle-result');result?.scrollIntoView({block:'start'});result?.focus();
  }}));
 }else{
  const finished=compared.length>0&&compared.every(sample=>sample.tick>=144);
  app.append(element('p',finished?'144일 비교 완료. 이름을 가린 세 영지의 구조와 재고를 비교하세요.':'같은 시작에서 세 방향으로 성장 중입니다. 144일에 멈춥니다.'));
  const grid=element('div','','comparison-grid');compared.forEach((sample,index)=>{const panel=section(`영지 ${String.fromCharCode(65+index)}`);panel.append(cityMap(sample,true),resourceView(sample));grid.append(panel);});app.append(grid,button('내 영지로 돌아가기',()=>navigate('town')));
 }
 app.append(status);
 if(page!=='compare'){
  const appearance=button(`지도 색감: ${eveningMap?'저녁':'기본'}`,()=>{eveningMap=!eveningMap;render();});
  appearance.setAttribute('aria-pressed',String(eveningMap));
  app.append(appearance,element('p','무료 외형 미리보기 · 지도 색감만 바뀝니다. 비교 화면은 기본 색감입니다.','note'));
 }
 const storage=element('div','','actions');storage.append(button('기록 저장',()=>{void save();}),button('저장 기록 이어하기',()=>{void restore();}));app.append(storage);
 const nav=element('nav');nav.setAttribute('aria-label','주요 화면');for(const[target,label]of[['town','영지'],['policy','방침'],['neighbor','이웃']]as const){const item=button(label,()=>navigate(target));if(page===target)item.setAttribute('aria-current','page');nav.append(item);}app.append(nav);
}
render();
