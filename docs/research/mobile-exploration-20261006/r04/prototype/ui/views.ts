import { AXES, AXIS_LABELS, RESOURCES, population, policyPreset, type City, type Policy, type Resource } from '../model/index.js';
import { element, button, section } from './dom.js';
import { cityMap } from './map.js';
const LABELS: Readonly<Record<Resource, string>> = { food: '식량', materials: '자재', tools: '공구', coin: '은화' };
export function resourceView(city: City): HTMLElement {
 const list = element('dl', '', 'resources');
 const values = [['주민', population(city)], ['정산일', city.tick], ...RESOURCES.map(r => [LABELS[r], city.stocks[r]])];
 for (const [label, value] of values) { const row = element('div'); row.append(element('dt', String(label)), element('dd', String(value))); list.append(row); }
 return list;
}
export function townView(city: City): HTMLElement {
 const view = element('div'); view.append(cityMap(city), resourceView(city));
 const report = section('주민들은 왜 이렇게 지었을까');
 const latest = city.receipts.slice(-4).reverse();
 if (!latest.length) report.append(element('p', '아직 건축 청원이 없습니다. 방침을 정한 뒤 시간을 진행하세요.'));
 for (const receipt of latest) {
  const item = element('details'), chosen = receipt.chosen;
  item.append(element('summary', `${receipt.tick}일 · ${receipt.householdId + 1}번 가구 · ${chosen ? AXIS_LABELS[chosen.axis] : '기다림'}`));
  if (chosen) {
   const reasons = element('ul');
   const names: Readonly<Record<string, string>> = { policy: '지원 방침', demand: '수요', skill: '가구 기술', site: '땅의 조건', access: '길 접근', competition: '경쟁', commute: '통근', seedPreference: '가구 선호' };
   const leading = Object.entries(chosen.reasons).filter(([,score]) => score > 0).sort((a,b) => b[1]-a[1]).slice(0,2).map(([key]) => names[key] ?? key);
   item.append(element('p', `${leading.join('와 ')}의 점수가 높아 이 생업과 위치를 골랐습니다.`));
   for (const [key, score] of Object.entries(chosen.reasons)) reasons.append(element('li', `${names[key] ?? key}: ${score.toFixed(1)}`));
   item.append(element('p', `입지 (${chosen.x}, ${chosen.y}), 선택 전 합계 ${chosen.score.toFixed(1)}`), reasons);
   item.append(element('p', `지출: ${RESOURCES.filter(r => receipt.costs[r] > 0).map(r => `${LABELS[r]} ${receipt.costs[r]}`).join(' · ')}`));
   item.append(element('p', `다른 후보: ${receipt.alternatives.map(a => `${AXIS_LABELS[a.axis]} ${a.score.toFixed(1)}`).join(', ')}`, 'note'));
  } else item.append(element('p', '현재 재고로 지을 수 있는 입지가 없어 생계 일을 이어갑니다.'));
  report.append(item);
 }
 view.append(report);
 const facilities = section('생업과 일손'), list = element('ul');
 for (const axis of AXES) {
  const active = city.facilities.filter(f => f.axis === axis && f.hp > 0);
  if (active.length) list.append(element('li', `${AXIS_LABELS[axis]} ${active.length}곳 · 일손 ${active.reduce((sum, f) => sum + f.workers, 0)}명`));
 }
 facilities.append(list); view.append(facilities); return view;
}
export function policyView(city: City, apply: (policy: Policy) => boolean): HTMLElement {
 const view = section('어떤 조건을 만들어 줄까요');
 view.append(element('p', '지원 비중을 섞으세요. 총 100 안에서 나누며, 주민이 재고·수요·입지를 보고 결정합니다. 건물은 직접 놓지 않습니다.'));
 let draft = { ...city.policy };
 const rows = element('div'), total = element('p'), message = element('p', '', 'message'); message.setAttribute('role', 'status');
 const inputs = new Map<string, { input: HTMLInputElement; output: HTMLOutputElement }>();
 const sync = () => {
  const sum = AXES.reduce((s, a) => s + draft[a], 0); total.textContent = `지원 ${sum.toFixed(0)} / 100 · 예비 ${Math.max(0, 100 - sum).toFixed(0)}`; total.className = sum > 100 ? 'error' : '';
  for (const axis of AXES) { const row = inputs.get(axis); if (row) { row.input.value = String(draft[axis]); row.output.value = String(draft[axis]); } }
 };
 for (const axis of AXES) {
  const row = element('label', '', 'policy-row'), input = element('input'), output = element('output');
  input.type = 'range'; input.min = '0'; input.max = '100'; input.step = '1'; input.setAttribute('aria-label', `${AXIS_LABELS[axis]} 지원 비중`);
  inputs.set(axis, { input, output }); input.addEventListener('input', () => { draft[axis] = Number(input.value); sync(); });
  row.append(element('span', AXIS_LABELS[axis]), input, output); rows.append(row);
 }
 const examples = element('div', '', 'actions');
 for (const axis of ['agriculture', 'craft', 'military'] as const) examples.append(button(`${AXIS_LABELS[axis]} 예시`, () => { draft = policyPreset(axis); sync(); }));
 examples.append(button('교역 + 해상 예시', () => { draft = policyPreset(['trade', 'maritime']); sync(); }));
 const submit = button('이 방침 적용', () => { const ok = apply(draft); message.textContent = ok ? '방침을 적용했습니다. 기존 시설은 남고 이후 주민의 판단에 반영됩니다.' : '총 지원 비중이 100을 넘습니다. 다른 축을 줄여 주세요.'; message.className = ok ? 'message' : 'message error'; }, true);
 view.append(examples, rows, total, submit, message); sync(); return view;
}
