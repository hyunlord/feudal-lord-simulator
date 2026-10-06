import { RESOURCES, type City } from '../model/index.js';
import type { BattleCommand, BattleResult } from '../model/battle.js';
import { hasPact, type ContractContext } from '../model/contracts.js';
import { element, button, section } from './dom.js';
import { resourceView } from './views.js';
import { cityMap } from './map.js';
import { contractEvent, contractReason } from './contract-copy.js';
export type EncounterActions = {
 readonly player: City; readonly neighbor: City; readonly context: ContractContext;
 readonly result: BattleResult | null;
 readonly battle: (command: BattleCommand, defending: boolean) => void;
 readonly advance: () => void;
 readonly offer: () => void;
};
export function encountersView(actions: EncounterActions): HTMLElement {
 const view = element('div');
 view.append(element('p', '가상 이웃도 같은 시작 재고와 규칙으로 자랍니다. 이 화면은 로컬 스냅샷 전투이며 서버 연결은 없습니다.', 'note'));
 const neighbor = section('강 건너 영지'); neighbor.append(cityMap(actions.neighbor), resourceView(actions.neighbor)); view.append(neighbor);
 const diplomacy = section('서로 필요한 것을 교환하기');
 const active = hasPact(actions.context.diplomacy, { from:'player',to:'neighbor',now:actions.context.now });
 diplomacy.append(element('p', active ? '유효한 통행·불가침 계약이 있습니다. 기한 동안 출정을 보류합니다.' : '재고와 운송료를 비교해 양쪽 모두 이익인 교환을 찾습니다. 상대가 거절할 수 있습니다.'));
 diplomacy.append(button('교역·불가침 제안', actions.offer), button('하루 진행 · 계약 정산', actions.advance));
 const entries = actions.context.diplomacy.receipts.filter(r => r.actor === 'player').slice(-4);
 for (const entry of entries) diplomacy.append(element('p', `${entry.at}일 · ${contractEvent(entry.event)}: ${contractReason(entry.reason)}`, 'note'));
 view.append(diplomacy);
 const battle = section('출정 목적과 입구');
 let mode: BattleCommand['mode'] = 'raid', entry: BattleCommand['entry'] = 'north';
 const modeSelect = element('select'); modeSelect.setAttribute('aria-label', '출정 목적');
 for (const [value,title] of [['raid','한정 약탈'],['siege','관문 공성']] as const) { const option = element('option',title); option.value=value; modeSelect.append(option); }
 modeSelect.addEventListener('change',()=>{mode=modeSelect.value==='siege'?'siege':'raid';});
 const entrySelect = element('select'); entrySelect.setAttribute('aria-label','진입 방향');
 const entrances = [['north','북쪽 길'],['east','동쪽 길'],['south','남쪽 길'],['west','서쪽 길']] as const;
 for (const [value,title] of entrances) { const option=element('option',title);option.value=value;entrySelect.append(option); }
 entrySelect.addEventListener('change',()=>{const chosen=entrances.find(([value])=>value===entrySelect.value);if(chosen)entry=chosen[0];});
 battle.append(element('p','주민 일부를 소집하고 식량·공구를 씁니다. 소집된 생존자는 다음 정산에 생산하지 못합니다. 약탈은 보호 재고를 제외한 10%와 운반량 중 작은 한도로 제한됩니다.'));
 const launch=(defending:boolean)=>{
  actions.battle({seed:actions.player.seed+actions.context.now,mode,entry},defending);
 };
 const controls=element('div','','actions');controls.append(modeSelect,entrySelect,button('출정 · 결과 보기',()=>launch(false),true),button('이웃의 습격을 방어',()=>launch(true)));
 battle.append(controls); view.append(battle);
 if(actions.result) {
  const result=actions.result,report=section('어떤 길을 거쳐 돌아왔나');
  report.id='battle-result';report.tabIndex=-1;report.append(element('p',result.reason));
  const map=cityMap(result.defender),route=document.createElementNS('http://www.w3.org/2000/svg','polyline');
  route.setAttribute('points',result.trace.map(p=>`${p.x*16+8},${p.y*16+8}`).join(' '));route.setAttribute('class','battle-route');map.append(route);report.append(map);
  report.append(element('p',`이동·접촉 ${result.steps}단계 · 출정 ${result.deployed}명 · 공격 손실 ${result.attackerLosses}명 · 방어 손실 ${result.defenderLosses}명`));
  report.append(element('p',`운반한 재고: ${RESOURCES.map(r=>`${({food:'식량',materials:'자재',tools:'공구',coin:'은화'})[r]} ${result.loot[r]}`).join(' · ')}`));
  const details=element('details');details.append(element('summary','경로와 노출 기록'));
  const list=element('ol');for(const point of result.trace.filter((p,i)=>i===0||p.phase==='objective'||i%8===0))list.append(element('li',`${point.step}: (${point.x},${point.y}) ${({advance:'진입',breach:'돌파',objective:'목표 확보',return:'귀환'})[point.phase]} · 노출 ${point.exposure.toFixed(1)} · 보급 ${point.food.toFixed(1)}`));details.append(list);report.append(details);view.append(report);
 }
 return view;
}
