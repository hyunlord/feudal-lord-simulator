# 소송 판결 시각 · 영주 응답 읽기

기준 본선: `16bc0436a170ca1d774bdb307debc0cf845377ea`. 가지: `codex/engine-b-suit-verdict`. 본선 병합은 REMOTE 담당.

목표: 저장 필드와 소송 진행 규칙을 바꾸지 않고, 판결 예정 시각과 현재 단계에서 가능한 영주 대응을 엔진의 단일 계산에서 읽는다. 본선의 남은 비용 계산은 `suitRemainingCosts`라는 별도 함수가 아니라 `suitActions().stageCosts`에 있다.

## 검증 계획

`scripts/remote/run.sh`의 FAIR-LINE 실험 한 개에서 `paired.sh`를 실행한다. sandbox seed 1–5는 기존 가드레일 종료 조건으로, lord seed 1–3은 각각 30년(120000틱)으로 기준판과 변경판을 비교한다. seed별 병렬 프로세스는 한 실행 안에서만 사용한다. 전체 상태 해시에 제외 경로는 없다. 가드레일 자체 성공 여부와 해시 동일성을 구분해 기록한다.

판정: **전체 상태 해시 8/8 일치, 통과**. DGX 실행 `engineB-suit-verdict-9131d40` (실행 커밋 `9131d406fcfedf8e78ac08d6a1a927f73144e531`), 소스 구현 `502d2bc64`. 화면 코드는 이 가지에서 수정하지 않았다.

원칙 A4·A5: 화면이 단계 기한과 판결 기한을 혼동하지 않도록 엔진 읽기를 제공하고, 기존 상태와 흔적을 그대로 보존한다.

## 렌더·REMOTE 인계 계약

- `suitVerdictTick(state, suit): number | null`: 완료된 현재 틱의 상태를 입력한다. 정상 진행에서 일반 절차 4철, 단축 절차 2철의 판결 예정 틱이 단계 전환 뒤에도 유지된다. 원고의 비용 부족으로 단계를 놓치면 다음 가능한 철부터 다시 계산한다. 미래 자금 확보를 보장하는 값은 아니다. 영주가 피고이면 방어 비용은 단계 진행을 막지 않는다. 판결 이후 또는 합의로 종결되어 미래 판결 단계가 없으면 `null`.
- `suitAwaitsLord(state, suit): boolean`: 현재 단계에서 거절 사유 없는 증거·후원·점유 집행/방어 대응이 하나라도 있는지. 단순히 영주가 당사자인지를 뜻하지 않으며, 자동 진행을 정지시키지 않는다. 심리는 거짓. 모든 단계에서 선택할 수 있는 자발적 합의·내주기는 이 판정에 넣지 않는다. 기존 명령의 비용·이미 제출됨·후원자 자격 판정을 재사용한다.
- 기존 `lordMattersDue` 및 화면 기한 소비자는 이 가지에서 변경하지 않는다. 화면 연결은 렌더 담당이며, 읽기 추가만으로 기존 자동 정지와 판의 역사가 바뀌지 않아야 한다.
- 저장 필드와 판 번호를 추가하지 않는다. 검증은 `/seen`을 포함한 모든 상태 경로를 해시한다.

## 실측 결과

| 모드 | seed | 종료 틱 | 전후 동일 SHA256 | 가드레일 자체 |
|---|---:|---:|---|---|
| sandbox | 1 | 372667 | `4acbfbf73150c374662e4c0ad98c526652ae04ddc2402d48118b50aeb8f122b2` | True → True |
| sandbox | 2 | 281575 | `3d768a2009ecf6b6f6bc6c9ff9eb3d1ba7c8e448e1db57df2547439969725f53` | True → True |
| sandbox | 3 | 299309 | `33b3d88a225ba3998eb8e0eae348ea30da62b9109dbcc7141a4a3ade4f7a51a7` | True → True |
| sandbox | 4 | 281572 | `db0ba1ff69a915f7142a024373889e0406ba5dd2de982fda288d363ecda78980` | True → True |
| sandbox | 5 | 333724 | `8c04888603b9163966aa02fa538984c0e3ca898c8f3ef2bb2d9dc3ce6c3d1f57` | True → True |
| lord | 1 | 120000 | `e72c67dcab065b367fd7adc6f0e3f2fe6b29c0cd9054506fec1247af4bab0de5` | 해당 없음 |
| lord | 2 | 120000 | `f3115e3256c752c531ab72eb9ccacd2c31722b5766cc254c8c46d15f53b58a36` | 해당 없음 |
| lord | 3 | 120000 | `f999cc7a601b90a911f53910f68db18e3f7986f19cc8493b3fd8133edeb86bee` | 해당 없음 |

- DGX 단계 경계·응답 시험 6/6 및 타입 검사 통과. Mac에서는 새 시험 6개와 기존 suitActions 2개, 합계 8/8 및 타입 검사·대상 ESLint 통과.
- 저장 필드 추가 없음. 실행 이후 소스와 시험 변경 없음. 해시에서 제외한 경로 없음.
- 원본 로그·seed 결과·요약은 `raw-evidence.tar.gz`에, 각 원본의 크기·SHA256은 `provenance.json`에 보관했다. 큰 sandbox `final-state.json` 10개는 DGX kept 경로와 로컬 `.remote-runs`에 보존하며 해당 원본 SHA256을 독립 재계산하여 비교표와 대조했다.
- 기존 실행기 경고: 기준 본선 깨끗한 클론의 `testedChanges.test.ts` 실패(`701518cd`)는 이 변경이 도입한 실패가 아니다. 본 기록의 단계 시험·해시 관문과 분리한다.
- 이 가지의 읽기 API는 화면에 아직 연결하지 않았다. 본선 병합은 REMOTE가 수행한다.

증빙 무결성 확인: 이 폴더에서 `shasum -a 256 -c SHA256SUMS`. 압축 원본은 `tar -xzf raw-evidence.tar.gz`로 읽는다.
