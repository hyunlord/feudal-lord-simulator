# Phase 7 — Stage 3: The Palisade Age

## 1. 구현 내용

- **시대 계약**: 촌락에서 목책마을로 넘어가기 위한 인구 60명, 곡물창고 1채, 예배당 1채, 목재 250 조건을 각각 독립적으로 판정한다. 조건 일부가 충족되면 제안이 나타나고, 확정 전에는 목책선을 수정하거나 `Escape`로 취소할 수 있다.
- **목책 지오메트리와 선포**: 정착지 점유 영역을 둘러싼 결정론적 경계를 만들고, 통로·충돌·유효 경로를 검증한다. 선포는 하나의 원자적 이벤트이며 경계 한 칸당 목재 15를 확정한다.
- **공사 수명주기**: 목책 구간은 최대 4칸 단위 공사 부지로 함께 생성된다. 각 구간은 120 builder-ticks가 필요하며 성문 기준 순서로 하나씩 자재를 받고 완성된다. 기존 Stage 2 운송·정체·진단 경로를 그대로 사용하며 선포 후 취소할 수 없다.
- **노동과 주거**: 선포 후 정확히 600 simulation ticks 동안 가용 일꾼의 40%를 목책에 배정한다. 생산 노동은 줄지만 테스트 시나리오에서 완전히 멈추지 않는다. 완성된 경계 안 주택은 보호 상태가 되고 바깥 주택은 레벨 3 상한을 적용받는다.
- **렌더링과 상호작용**: 금색 점선 제안, 선포 의식, 건설 중 목책, 완성 목책과 성문, 건물 upgrade wave를 실제 canvas 경로로 그린다. 건설 중 구간을 canvas에서 선택하면 자재·배달·작업·일꾼·취소 불가 사유를 진단 카드로 확인할 수 있다.
- **UI와 반응형**: 시대 콘솔, 네 개의 독립 요구 조건, 제안/진행/진단 문구를 기존 궁정 콘솔에 통합했다. 375px에서도 시대·목표·장부·오버레이·속도 조작부가 잘리지 않도록 전용 열 비율과 압축 배치를 적용했다.
- **결정론과 문서화**: Stage 3 상태를 직렬화하고 요구 조건 도달, 선포, 노동 연속성, 목책 완성을 실제 reducer/tick 경로로 재생한다. 엔진·지오메트리·표현 경계는 `ARCHITECTURE.md`와 `DECISIONS.md`에 기록했다.

## 2. DGX 실브라우저 캡처

아래 이미지는 DGX의 실제 React/reducer/tick/canvas 경로를 Chromium으로 실행해 얻었고, 두 번의 독립 시각 검토에서 모두 PASS를 받았다.

1. [요구 조건 게이지 일부 달성](assets/stage3_partial_gauges.png)
2. [금색 점선 목책 제안](assets/stage3_dashed_preview.png)
3. [목책 시대 선포 순간](assets/stage3_proclamation_ceremony.png)
4. [절반 건설 및 정체 구간 진단](assets/stage3_half_built_stall.png)
5. [정착지를 둘러싼 완성 목책](assets/stage3_completed_enclosure.png)

## 3. 결정론 해시

| 항목 | 해시 | 결과 |
| --- | --- | --- |
| Stage 2 호환 해시 | `5a393f13af3e61be` | PASS |
| Stage 3 신규 해시, run 1 | `b8347aef1a6a5cd6` | PASS |
| Stage 3 신규 해시, run 2 | `b8347aef1a6a5cd6` | PASS |
| 전체 기존 하네스 해시 | `87534771560041e7` | PASS |
| 하네스 로그 SHA-256, run 1/2 | `11ca471e85dffbefeffe0e31b5206ba2748ad6806ff46791df425284cd9e1178` | byte-identical |

## 4. 하네스 결과

DGX에서 코드 후보 `85d81167dcc1b07bea464f4a07229ad2bacccd2d`로 `npm run harness`를 두 번 실행했다.

| 지표 | 값 | 결과 |
| --- | --- | --- |
| Food stability | starving 9.5% | PASS |
| Cargo thrashing | 0 cancellations / 1200 | PASS |
| Labour deadlock | 0 consecutive ticks | PASS |
| Housing oscillation | 1 change / 2000 | PASS |
| Stall duration | 152 consecutive ticks | PASS |
| Builder starvation | 0 consecutive ticks | PASS |
| Material deadlock | 0 consecutive ticks | PASS |
| Completion rate | 2/2 scripted sites | PASS |
| Palisade reachability | 0 ticks | PASS |
| Palisade wall completion | 선포 후 1259 ticks | PASS |
| Palisade labour continuity | 비목책 생산 중단 0 ticks | PASS |

## 5. 시나리오 소요 시간

- 하네스 시나리오의 시대 조건은 bootstrap 상태에서 즉시 도달 가능했다(`reachability = 0`). 의사결정을 관찰할 수 있도록 선포는 고정된 **tick 600**에 수행됐다.
- 목책 전체는 선포 후 **1259 ticks**, 즉 **tick 1859**에 완성됐다. 허용 상한 3000 ticks보다 1741 ticks 빠르다.
- 선포 직후 노동 전환 구간 600 ticks 동안에도 비목책 생산의 연속 중단은 0 ticks였다.

## 6. 테스트와 5× 프레임 시간

- DGX `npm test`: **631 passed, 0 failed**, 12 suites.
- DGX `npm run typecheck`: PASS.
- DGX `npm run build`: PASS, Vite production bundle 생성.
- DGX 자산 경계 테스트: **10 passed, 0 failed**.
- 실브라우저 판정: 1280/768/375 모두 수평 overflow 0, page error 0, request failure 0. `Escape`, 잘못된 drag, 의식 닫기, reload, tooltip 검사가 모두 PASS.
- 5× benchmark 3회: 평균 **4.939 / 4.852 / 4.902ms**, p95 **5.6 / 5.4 / 5.4ms**, 최악 **9.1 / 8.0 / 7.7ms**, 12ms 초과 프레임은 모두 0.

## 7. Git과 배포

- 코드 후보: `85d81167dcc1b07bea464f4a07229ad2bacccd2d`
- 검토 완료 캡처 커밋: `93119d675da668054e554675c4f85461ef853e3b`
- 작업 브랜치: `codex/stage3-palisade-age`
- 원격: `https://github.com/hyunlord/feudal-lord-simulator.git`
- GitHub: <https://github.com/hyunlord/feudal-lord-simulator>
- DGX 개발 서버: <http://100.70.109.50:3200/>
- 최종 release SHA는 이 보고서를 포함한 `main` HEAD이며, 로컬 `main`, `origin/main`, GitHub `refs/heads/main`, DGX `main`의 동일 SHA/tree를 배포 증거에서 재검증한다. 강제 push는 사용하지 않는다.

## 8. 솔직한 체감 평가

### 선포는 결정이었나, 불이 켜지자마자 누른 버튼이었나?

지금 시나리오에서는 **불이 켜지자마자 누르는 버튼에 더 가깝다**. 목재 비용과 40% 노동 전환은 실제 시스템 비용이지만, 조건을 충족한 시점에는 다른 긴급 선택지와 정면으로 경쟁하지 않는다. 비용은 계산되지만 플레이어가 망설일 만큼의 기회비용은 아직 약하다.

### 목책이 올라가는 장면은 사건이었나, 기다림이었나? 5×를 찾았나?

선포 직후 의식과 첫 구간 착공은 사건처럼 보이지만, 14개 구간이 순차 완성되는 중반부터는 **기다림**이 된다. 실제 검증에서도 5×를 사용하고 싶었다. 정체 구간을 클릭해 원인을 읽을 수 있어 무의미한 대기는 아니지만, 중간 이정표나 속도 변화가 없으면 관람 시간이 길다.

### upgrade wave는 마을이 바뀌는 순간으로 느껴졌나?

**알아볼 수는 있지만 payoff로는 아직 약하다.** 의식, 금색 물결, 목책 착공이 연속되어 전환 자체는 등록되지만, 건물 변화가 짧고 절제되어 있어 지형과 목책에 시선이 가면 놓치기 쉽다. 이 slice의 보상 순간을 더 강하게 만들려면 음향 없이도 읽히는 두 번째 시각 신호나 잠깐의 카메라 강조가 필요하다.

## 알려진 잔여 위험

- 375px에서 모든 조작부는 보이지만 영문 overlay label 일부는 `Distributi`, `Road con...`처럼 축약된다. 접근 가능한 전체 이름은 `aria-label`에 유지된다.
- 체감 평가에서 드러난 선포 기회비용과 공사 중반 pacing은 버그가 아니라 다음 밸런싱/연출 후보이며, 이번 Stage 3 범위에서는 수치를 추가 조정하지 않았다.
