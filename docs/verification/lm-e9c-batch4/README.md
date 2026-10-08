# Engine B 4차 묶음 — 마지막 여섯 보류 어댑터

기반 `776f2d67b560e900e604e4a36607edeb35d1e246`, 구현 참조 `42f0f6c8cd8bcadc074e4f8282982c7298353da9`. 로컬 구현 `b367c30f`·집중 검증을 마쳤다. 본선 게시·원격 변경 시험·20년 자연 관측·최종125년 관측은 별도 진행한다.

## 연결 범위와 보류

| ID | 읽는 사실 | 보류 선택 |
| --- | --- | --- |
| ck_evt_087 | 실제 폐업 기록과 그 뒤 시작된 현재 생업, 시장·거주 당사자 | b,c |
| ck_evt_088 | 실제 맥주 양조·제분 가구와 보리·밀 | a,b,c |
| ck_evt_093 | 해당 장인의 실제 최근 도착/이주 기록, 별개 상인·시장 | b,c |
| ck_evt_095 | 시장 보조금과 실제 보조금 예산 압박 산술 | a,b,c |
| ck_evt_100 | 가득 찬 창고, 관리인/수레꾼·상인, 시장/창고 사업 수요 | a,b |
| ck_evt_170 | 운송할 곡물·수용처·길, 실제 부족한 생산 인력과 수레꾼 가구 | a,b |

여섯 사건은 필터 연결과 동시에 해당 선택을 보류했다. 모두 DEC-TRACE의 유효 선택 두 개 미만 조건으로 독립 실행되지 않는다. 기존 HOLD38·11개 독립 사건·5개 비추첨 변주·앞선 5개 보류 어댑터를 보존했다. 090의 실제 목수 조건, 057/058 생애, 핵심 엔진·저장·UI·관문은 변경하지 않았다.

실제 `registryV4Support()` 결과: 전체 215건, 독립 실행 56, 명시 보류 52, 미구현 필터 84. Engine B 27건은 독립 실행 11 + 비추첨 변주 5 + 보류 11이다. 결정 무게는 영주 8, 청지기 19로 유지된다. 전체 27건 어댑터 제공은 27건 독립 활성화를 뜻하지 않는다.

## 로컬 검증

집중 회귀 116/116, TypeScript 타입 검사, 변경 TypeScript 파일 ESLint, `git diff --check` 통과. 로컬 실행 원본은 `/tmp/engine-b-batch4-focused.txt`, `/tmp/engine-b-batch4-typecheck.txt`에 있다. 이 기록은 원격·자연 관측 증거가 아니다.

```sh
node --import tsx --test tests/engineBBatch*.test.ts tests/engineBDecision*.test.ts tests/registryV4.test.ts tests/registryChapterAdapter.test.ts tests/registryChapterPetitions.test.ts tests/registryChapterTrace.test.ts tests/registryStewardSuccessionContext.test.ts tests/registryWoodlandPetition.test.ts tests/registryPasturePetition.test.ts tests/registryMarketRoadPetition.test.ts tests/registryParishContext.test.ts tests/registryVariants.test.ts tests/registryDecisionPresentations.test.ts tests/registryLogisticsContext.test.ts
npm run typecheck
git diff --check
```

새 시험은 실제 `bindEntry`와 고정 자료 재검사, 자료 소실·대체, 보류 이유·선택 ID, 유효 사실이 있어도 `v4Candidates`에서 제외됨을 확인한다. 093은 친족의 도착을 기존 장인의 도착으로 가장하지 않는다. 100은 과거 사업 제안을 유지할 수 있으나 실제 대상 완공이나 현재의 반대 판단은 거부한다.

170은 인력 부족이 아닌 혼잡, 운송할 재고 없음, 전량 예약 재고, 수용처 없음/포화, 도로 없음, 사망·부재·미성년·다른 직업의 당사자를 거부한다. 같은 발생의 일부 곡물 이동은 허용하지만 적체 발생 시각·건물·수레꾼 신원이 바뀌면 고정 바인딩이 무효가 된다. 연도 경계 시험은 1348년 합성 자료이며 자연 경과 관측이 아니다.

## 의미·관측 한계

087은 폐업과 나중 개업의 시간적 공존을 증명할 뿐, 같은 부지에서의 대체나 앞선 폐업이 뒤 개업을 일으켰다는 인과를 증명하지 않는다. 시험은 서로 다른 가구·생업으로 이 경계를 유지한다.

095는 시장 보조금을 줄이면 다른 24d 지원을 감당할 수 있다는 예산 조건이다. 과거 시장 지원금을 실제 사용한 영수증이 있어도 조건이 성립한다는 시험을 넣었다. 따라서 `unused_subsidy`라는 내부 전략명을 실제 미사용 증거로 설명하지 않는다.

보류를 해제하려면 결정·지원→실제 가구/사업 선택→결과의 연결과 그에 맞는 문안이 별도로 필요하다. 이번 읽기 어댑터가 그 인과를 새로 구현하지 않는다. 이전 변주 API의 화면 소비자는 여전히 없으며 화면 문안 설치를 주장하지 않는다.

다음 검증은 정확한 누적 트리의 20년 자연 관측이며 이번 여섯 사건의 신규 독립 발생 0은 의도한 결과다. 170은 1348년 이후 창이므로 1300–1320 관측 밖이다. 마지막 누적 트리에서 단 한 번의 최종 125년 관측을 남겨 두며, 1300–1425 기간은 기존 080의 1430–1450 창을 포함하지 않는다.

## 완료한 그림 검증

공식 Mac `npm run eventart:auto`, 브라우저 실행 `engineB-batch4-EVA-41960dc`: 활성56/56 그림, 캡처770초·명령795.7초·exit0. Mac 출처 적용 뒤 관련7시험 통과. 독립 검수16시험과 리더14시험도 통과했다. 준비 상태 그림을 자연 발생으로 세지 않는다. 새 독립 활성은0이며 HOLD38과 이번 여섯 보류를 유지한다.

## 20년 결과와 카드 기하 보존

DGX `engineB-batch4-20y-1f3ba48`는 exit0으로 끝났다. 1300–1320 미만 seed1/2/3 발생10/12/12건, 응답8/8/9건, 무효2/4/3건이다. 보류 여섯 건은 독립 사건을 추가하지 않는다. 원본7개 원격SHA-256 일치·보고서3개 재생성 바이트 일치를 확인해 `distribution/`에 보관했다. GP7은`measured_not_adjudicated`이다. 최신 본선의 경제 변경 이전 결과이며 최종 병합판 관측으로 주장하지 않는다.

기하 실행 `engineB-batch4-geometry-41960dc`도 exit0이다. 해당 이름의 기하 보고서를 함께 보존한다. 본선 카드 변경을 합친 뒤 필요한 관문은 별도로 갱신한다.
