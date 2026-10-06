# R04 보충 실험: 사전 고정된 표본과 실행법

2026-10-06. 결과에 따라 표본을 고르지 않는다. 본 파일 작성 시 전체 보충 리그는 미실행이며 구현/훈련용 소수 QA만 완료했다. 본 리그 결과와 도전자 모집단은 섞어서 같은 승률인 것처럼 보고하지 않는다.

## 범위와 표본

| 종류 | 사전 고정 표본 | 건수 | 원자료 |
|---|---|---:|---|
| growth | seed1..5 × 5지형 × (BASE12 + 4혼합쌍×75/25·50/50·25/75 + 정책0대조군1) | 625도시, 1,875시점 | 48/96/144정산 인구·노동·시설·좌표·길·재고·서비스·흐름·선택 이유 |
| challenge | CHALLENGERS3 × BASE12 × 5지형 × seed201..206 × 역할교환2, 성장96 | 2,160경기 | 초기/대외후/회복후 상태, 모든 전투·결정·계약 |
| diplomacy | 외교/농업, 외교/교역, 외교/군사, 농업+외교/군사 ×5지형 × seed1..5 ×2역할 ×ON/OFF | 400경기(200짝) | 제안/수락/거부/이행/위반/만료, 피한 출정, 자원 순흐름 |
| geometry | 동일 개수/인구/재고/seed의 창고 근거리·원거리 및 경비소 경로변·바깥 비교, seed1..5 | 5쌍 묶음(20전투) | 실제 경로·이동시간·노출·손실·식량 |

혼합쌍은 교역/해상, 신앙/군사, 제작/학문, 농업/외교다. 50/50은 BASE 혼합과 의도적으로 중복돼 동일 벡터가 이름 때문에 결과를 바꾸지 않는지 확인할 수 있다. 정책0 대조군은 각 seed/지형마다 하나이며 동일 초기 조건의 모든 전략에 공통 대조군이다. 대조군을 다른 seed의 도시와 비교하지 않는다.

도전자 중 continuous-1/2는 기존 `strategies.ts`에 고정된 연속 벡터 두 개이며, adaptive-shortage는 실제 부족재를 보고 정책을 바꾼다. 무작위 정책공간의 대표성을 보장하지 않는다. 각 도전자는720경기, 각 BASE는180경기에 참여하므로 합계 승수를 비교하지 않고 해당 분모와 모집단을 보고한다.

외교 ON/OFF는 초기 도시·seed·정책·좌석·성장·명령 생성기가 같고 계약 enabled만 다르다. 결과 뒤 경제와 전쟁 경로가 달라지는 것은 개입의 실제 결과다. 비교는 `task.game.block`별 두 행을 짝지어 한다. 이 표본은 외교가 포함된 네 관계의 인과 시험이며 전동맹 메타의 대표 표본이 아니다.

## 지표 해석

- 성장 `points[].flows`는 계정:이유별 모든 자원 원장 합계다. 연속 시점 차분으로 해당 구간 순흐름을 얻는다. 생산량/수입/소비를 이유별로 분리한다. 퇴역(hp0) 시설은 활성 시설 수에서 제외한다.
- 모든 시설의 좌표와 길을 보관한다. 반경 하나만으로 다양성을 입증하지 않는다. 구성 벡터·시설 간 거리·생산흐름·원 정책벡터와 함께 비교한다.
- `metrics.ledgerProfit[].netContractResources`는 **도시 계정의 계약 원장만** 가격 식량1/자재2/공구4/은화1로 합친 명목 순흐름이다. 후생·인구·회피 전쟁 이득 또는 수익률이 아니다. `nominalOwnedEscrow`는 종료 시 여전히 본인이 소유한 계약 재고/보증금의 같은 가격 평가다. 소유가치 변화에는 이 값도 포함하고, 자유 재고와 중복 계산하지 않는다. 매각되지 않은 예상 이익은 넣지 않는다.
- 계약 offered/accepted 등의 수는 양쪽 영수증 중복을 계약ID+시각으로 제거한 사건 수다. 자동 제안기가 상호 이익 후보를 못 찾아 제안을 내지 않은 경우는 실제 `rejected` 응답으로 세지 않는다. 거부0이면 그대로0으로 보고하며 수요가 완벽히 맞았다고 해석하지 않는다.
- 피한 출정은 실제 game decision이 `honor-pact`가 된 횟수다. ON/OFF에서 총 약탈 횟수의 차이와 따로 보고한다. 약탈 의지가 없었던 평화 결정을 피한 출정으로 세지 않는다.
- geometry는 평지/전면 도로의 **합성 통제 장면**이다. 자연 발생 도시의 평균 효과가 아니다. 같은 병력/시설 개수/재고 확인과 경로/소모/노출 차이를 함께 기록한다.
- cosmetic은 이 러너에서 가짜 유료 flag를 붙여 통과시키지 않는다. 실제 UI 외형 팔레트 전환 전후 상태 검증은 별도 UI QA다. 구매 구현은 없으므로 수익화 검증 범위를 ‘외형 제어 경계 + 설계’로 한정해야 한다.

## 실행과 재개

루트는 `/Users/rexxa/fls-astra-mobile/mobile-study`. 새 의존성 없음. 부모가 모델을 동결한 뒤 실행한다.

```
../node_modules/.bin/tsc --noEmit -p prototype/tsconfig.json
../node_modules/.bin/tsc -p prototype/tsconfig.json
node prototype/dist/league/supplement.js --kind challenge --plan yes --count 100
```

`--plan yes`가 기본이며 실행하지 않고 건수·범위·소스/스케줄 해시만 출력한다. 현재 보충 소스 해시는 다음과 같다(자체 실행 소스 포함이라 본 리그 해시와 다름).

`4d2b139cc08ea0618e64442abd6d782dbc71e25b27d9a2e309d1ef208082762a`

```
node prototype/dist/league/supplement.js --kind growth --plan no --freeze-hash 4d2b139cc08ea0618e64442abd6d782dbc71e25b27d9a2e309d1ef208082762a --start 0 --count 100 --out records/supplement-final
```

kind는 growth/challenge/diplomacy/geometry. start는0부터, count는1..100. 해당 범위가 끝나면 다음 범위를 호출한다. 30초 협력적 제한에 걸리면 같은 start/count로 재개한다. 한 동기 경기 도중 중단하지 않으므로 30초가 절대 시간 상한은 아니다. 서로 겹치는 범위를 동시에 돌리지 않는다.

각 완료 작업은 `<kind>-<index>.json.gz` 하나에 원자적 저장된다. 내용은 `{index,id,sourceHash,scheduleHash,taskHash,resultHash,result}`다. 재개 때 gzip·JSON·해시·소스·스케줄·ID·index를 확인하고 이미 완료된 작업은 재계산하지 않는다. 다른 소스는 같은 출력 폴더의 provenance와 일치하지 않으면 거부한다. 각 작업 전후 소스 일치도 확인한다. 프로세스 비정상 종료가 남긴 lock은 실제 PID의 종료를 확인한 후에만 처리한다.

소스 범위는 model/*.ts 중 session.ts 및 생성된 build-identity.ts 제외, league의 game/strategies/schedule/compact/supplement/supplement-data/supplement-geometry다. UI나 분석 문서 변경은 시뮬레이션 동결을 깨지 않는다. sourceFiles 원문 목록은 provenance JSON에 들어간다.

## 현재 확인 증거

- 전체 prototype strict tsc 통과, compiled Node 경로에서 --plan 동작 확인(도전자2,160, execution=false).
- `records/supplement-qa-v2`: 새 동결 해시에서 geometry5개와 seed1 강가 외교/농업 ON/OFF 2개 실행 완료. 같은 명령 재개는 executed0,verified2.
- 이전 `records/supplement-qa`: 이전 러너 해시의 성장1개와 재개, geometry5, 외교2가 있다. 최종 모집단에 섞지 않는다.
- geometry 최초 QA의 5seed 모두 동일 개수/재고/인구, 다른 경로, 원거리 추가식량, 동일 병력, 경로변 경비소 높은 노출이 true였다. 최종 동결 출력도 별도로 보존했다.
- 이 문서 시점에서 seed201..206 도전자 경기는 실행하지 않았다. 평가 결과나 지배전략 부재를 주장하지 않는다.

## 전체 완료 후 분석

분석기는 실행 소스 동결 범위 밖의 `supplement-analysis.ts`, `supplement-analysis-data.ts`, `supplement-plot.ts`다. 모델이나 game을 바꾸지 않는다.

```
../node_modules/.bin/tsc -p prototype/tsconfig.json
node prototype/dist/league/supplement-analysis.js --kind all --in records/supplement-final --out records/supplement-analysis
```

kind 하나만 지정할 수도 있다. 반드시 해당 종류 전체 건수를 요구하며 누락/추가 파일, 저장 스케줄 차이, sourceFiles 목록 해시, 원자료별 source/schedule/task/result 해시, id/index/task 불일치를 거부한다. 예상 625/2160/400/5를 작은 QA 건수에 맞춰 줄이지 않는다. 분석 출력: 종류별 analysis JSON, 검증 파일 SHA256 JSON, 한국어 `SUPPLEMENT_RESULTS.md`, 8순수축 식량 평균 성장곡선 `growth-food.svg`(25훈련도시 평균, 신뢰구간 없음).

성장은 전략/지형/시점별5seed 평균과 모든 perSeed 원자료 요약, 정책0 짝차이, 혼합 반대비중 차이 및50/50 별명 불변성을 출력한다. 도전자 및 BASE-against-challengers의 승점률/승무패/seed군집2,000bootstrap95%구간은 분리한다. 외교는200짝별 종료가치·인구 차이/계약 사건/피한 출정/실제 약탈/명목 순흐름/알려진 사절·운송비를 출력한다. 해당 비용은 실제 accepted 영수증이 있는 계약의 운송비와 실제 제안의1은화 사절비이며 위반 페널티/이전은 포함하지 않는다.

분석기 QA: strict tsc 통과; 새 동결 geometry5개 전체 읽기/검증/한국어 보고서 생성 완료(`records/supplement-analysis-qa`). 외교2개뿐인 QA 폴더를 전체 분석시키면 `expected400, actual2`로 실패함을 확인했다. 전체 성장/도전자/외교 분석은 실제 자료가 완성된 뒤 실행해야 한다.

### 분석 검증 강화

분석기는 source/compiled 위치에서 prototype 루트를 찾아 현재 `model/*.ts`(session/build-identity 제외)와 명시된7개 league 실행 파일 목록을 다시 만든다. provenance에 중복·안전하지 않은 경로·누락·추가 파일이 있으면 거부하고, 모든 파일의 현재 SHA256을 provenance와 비교한다. 목록 자체의 해시만 맞춰 위조하는 입력도 통과하지 않는다. 경기 종료 V는 살아 있는 인구와 순소유 재고/에스크로를 `metrics.value`로 다시 계산하여 저장 값과 일치해야 한다.

검증 기록 `records/supplement-analysis-qa/PROVENANCE_QA.json`: 복사본 provenance에서 파일1개 삭제 후 목록 해시를 다시 계산한 경우 거부(exit1), 파일 SHA만 바꾸고 목록 해시를 다시 계산한 경우 현재 소스 불일치로 거부(exit1), 훈련 경기 V를1 증가시킨 경우 거부. 실제 모델 파일은 수정하지 않았다. 새 검사에서도 geometry5개는 source 및 compiled Node 경로 모두 통과했다. 실행 소스 동결 해시4d2b139…82762a는 그대로다.
