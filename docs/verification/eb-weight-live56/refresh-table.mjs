// Offline audit ledger rendering only; never launches a game or changes a verdict.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const inventory = JSON.parse(readFileSync(new URL('./inventory.json', import.meta.url)));
assert.equal(inventory.rows.length, 56);
assert.equal(new Set(inventory.rows.map(row => row.entryId)).size, 56);
const labels = {
  incomplete_harness_after_answer: '관측 미완: 답 후 하네스', pending: '미검증', pass_one_choice: '통과(한 선택)', pass_two_supported_choices: '통과(두 지원 선택)',
  fail_navigation_state_changed: '실패: 탐색 SHA 변경', fail_screen_chip_capacity: '실패: 칩 자리 제한',
  fail_observation_interrupted: '미통과: 관측 중단', fail_missing_input: '미통과: 실제 입력 없음',
  fail_missing_trace: '실패: 실제 효과의 trace 없음', fail_conditional_unobserved: '미통과: 조건부 결과 미관측',
  steward_route_only: '별도 청지기 보고 경로', fail_harness: '미통과: 하네스', fail_screen: '실패: 화면',
};
const missingIds = new Set([...readFileSync(new URL('./missing-inputs.md', import.meta.url), 'utf8').matchAll(/^\| (\d{3}) \|/gm)].map(match => match[1]));
const count = value => inventory.rows.filter(row => row.screenVerdict.startsWith(value)).length;
const actualFailures = inventory.rows.filter(row => row.verdictGroup === 'actual_failure');
const observationShortfall = inventory.rows.filter(row => ['fail_missing_input', 'fail_conditional_unobserved'].includes(row.screenVerdict));
const harnessIncomplete = inventory.rows.filter(row => row.verdictGroup === 'harness_incomplete');
const lines = [
  '# EB-WEIGHT 56사건 실제 화면 관문', '',
  `진행 중: 사건별 통과 ${count('pass_')}/56, 실제 실패 ${actualFailures.length}, 관측 미달(사건/조건 미도달) ${observationShortfall.length}, 하네스 관측 미완 ${harnessIncomplete.length}, 미검증 ${count('pending')}, 청지기 별도 경로 ${count('steward_')}. 전체 관문 통과가 아니다.`, '',
  `다음 실행 제품 ${inventory.product}. 통과${count('pass_')}건과 기존 실패 증거는 기준 0eddc146이며 새 본선의 재검증 결과가 아니다. 분모 56사건/163지원선택을 유지한다. 한 선택 통과를 다른 선택의 통과로 확대하지 않는다. 056은 이 분모 밖이며 렌더A 소유다.`, '',
  '통과 기준은 실제 결과, 그 뒤 칩 갱신·노출, 정확한 카드 항목, 탐색 SHA 불변(/seen만 제외), 원본 JPEG 검토다. reader 포함만으로 통과시키지 않는다. 입력이 없는 사건은 제품 결함이나 영구 도달불가로 단정하지 않는다.', '',
  '| ID | 지원 선택 | 선택(검증/예정) | 현재 판정 | 증거 / 제한 |',
  '|---|---|---|---|---|',
];
for (const row of inventory.rows) {
  assert.ok(labels[row.screenVerdict], `Unknown verdict ${row.screenVerdict}`);
  const link = row.evidence ? [row.evidence].flat().map((path, index) => `[증거${index + 1}](${path})`).join(' · ') : missingIds.has(row.entryId.slice(-3)) ? '[입력 조건](missing-inputs.md)' : '입력 장부만 있음';
  const choice = row.screenVerdict === 'pass_two_supported_choices' ? 'lower, keep' : row.liveCase?.choice ? `${row.screenVerdict === 'pending' ? '예정: ' : ''}${row.liveCase.choice}` : '아직 없음';
  const limits = String([row.baselineNote, row.failureCause, row.limits].filter(Boolean).join(' ')).replaceAll('|', '/').replaceAll('\n', ' ');
  lines.push(`| ${row.entryId.slice(-3)} | ${row.supportedChoices.join(', ')} | ${choice} | ${labels[row.screenVerdict]} | ${link}; ${limits} |`);
}
lines.push('', '## 실패 원인 구분', '',
  '- 규칙: 실제 상태 변화가 없는 답. 처리 기록 증가만으로 효과를 만들지 않는다.',
  '- 흔적: 실제 변화는 있지만 해당 답ID로 연결되지 않음.',
  '- 화면: 정확한 trace와 연간 읽기가 있는데 칩/항목이 누락되거나 탐색 SHA가 달라짐.',
  '- 하네스/관측: 관련 없는 개입·관측 창 때문에 아직 실제 결과에 닿지 못함. 제품 결함으로 합산하지 않음.',
  '- 입력: 진짜 제안/성공 답 저장이 없음. 정본을 넓히거나 사실을 채워 넣지 않음.',
  '- 청지기: 실제 청지기 처리 발생을 영주 칩 통과로 세지 않고 계절 보고를 따로 확인.', '',
  '공식 FAIR-LINE 실행 하나가 종료된 뒤 다음 실행을 제출한다. 이 표 생성기는 보존 장부만 읽으며 게임·브라우저·DGX를 실행하지 않는다.', '');
writeFileSync(new URL('./results.md', import.meta.url), lines.join('\n'));
console.log(JSON.stringify({ rows: inventory.rows.length, passed: count('pass_'), actualFailures: actualFailures.length, observationShortfall: observationShortfall.length, harnessIncomplete: harnessIncomplete.length, pending: count('pending') }));
