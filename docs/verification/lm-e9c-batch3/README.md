# Engine B 3차 묶음 — 로컬 어댑터 검증

기반 `ccb161c58cfaaca3fb3ef43cc58842e65f059d4f`, 구현 참조 `42f0f6c8cd8bcadc074e4f8282982c7298353da9`. 이번 작업은 원래 가지 전체를 덮어쓰지 않고 7건만 연결했다. 아직 커밋·게시·원격 변경 시험·20년 자연 관측을 수행하지 않았다.

## 정확한 범위

- `ck_evt_067`, `ck_evt_078`: 기존 031/059, 019 발생의 제목·본문을 제공하는 변주 API. 독립 추첨하지 않는다. 기존 발생 ID·선택·효과·기한을 유지한다.
- `ck_evt_050`, `ck_evt_062`, `ck_evt_065`, `ck_evt_068`, `ck_evt_085`: 실제 사실을 읽는 어댑터만 연결했다. 간접 정책·장려금 선택을 함께 보류해 다섯 사건 모두 비활성이다.
- 보류 선택: 050 `stability,growth,revenue`; 062 `b,c`; 065/068/085 각각 `a,b,c`.
- HOLD38, 기존 보류 선택, 090의 실제 목수 조건, 057/058 생애 처리와 DEC-TRACE 무게는 유지했다. Town/Estates 사실 모듈은 수정하지 않았다.

현재 실제 `registryV4Support()` 결과는 전체 215건 중 독립 실행 56, 명시 보류 46, 미구현 필터 90이다. Engine B 27건 안에서는 독립 실행 11, 비추첨 변주 5, 이번 보류 어댑터 5, 미연결 6이다. 남은 6건은 087/088/093/095/100/170이며 이번 변경에서 해제하지 않았다.

## 로컬 검증

집중 회귀 102/102 통과, TypeScript 타입 검사, 변경 TypeScript 파일 ESLint 및 `git diff --check` 통과. 원본 로컬 실행 출력은 `/tmp/engine-b-batch3-focused.txt`, `/tmp/engine-b-batch3-typecheck.txt`에 있다. 원격 검증 영수증은 아니다.

검증 명령:

```sh
node --import tsx --test tests/engineBBatch*.test.ts tests/engineBDecisionWeights.test.ts tests/registryV4.test.ts tests/registryChapterAdapter.test.ts tests/registryChapterPetitions.test.ts tests/registryChapterTrace.test.ts tests/registryStewardSuccessionContext.test.ts tests/registryWoodlandPetition.test.ts tests/registryPasturePetition.test.ts tests/registryMarketRoadPetition.test.ts tests/registryParishContext.test.ts tests/registryVariants.test.ts tests/registryDecisionPresentations.test.ts
npm run typecheck
git diff --check
```

변주 시험은 저장 왕복, 원래 발생의 실제 명령 무게 `land`, 기존 응답 결과 불변, 포함 기한, 원래 인물 소실·교체, 더 우수한 새 후보가 원래 후보를 대체하지 못하는 경계를 확인한다. 보류 어댑터 시험은 실제 `bindEntry`/고정 바인딩 재검사, 원인 자료 소실·교체, 일부 자재 이동, 보류 선택 ID, 실제 `v4Candidates` 제외를 확인한다. 050은 교회·거주지·성인 대표를 확인하며 독립 후보가 아니다.

## 증거의 한계

068은 실제 보조금 지급 영수증과 그 뒤의 **전체 현금 순감소**를 함께 읽는다. 다른 사업의 유지비만 있어도 조건이 성립하며, 그 감소를 해당 보조금 사업의 손실로 귀속하지 않는다. 무관 지출, 이를 상쇄하는 수입, 이미 합산된 원장 기간을 별도 시험했다. 이 사실만으로 정책 선택 보류를 해제하지 않는다.

065/085의 사업 수요 시험은 합성 제안 자료로 어댑터 경계를 검증했다. 고정된 과거 제안은 다음 시점에도 유지될 수 있으나, 해당 위치의 사업이 시작·완료되거나 현재 판단이 반대하면 무효다. 과거 제안을 현재 계획기의 판단으로 표현하지 않는다.

두 변주 API 모두 `src`에서 정의 외 소비자가 없다. 이번 작업은 화면 문안 설치가 아니며 UI·그림·화면 검증을 수행하지 않았다. 20년 자연 관측은 이후 정확한 누적 트리에서 수행해야 한다. 이번 7건의 신규 독립 발생 0은 의도한 결과다. 최종 125년 관측은 마지막 묶음에 남겨 두며, 1300–1425 판으로 080의 1430–1450 창을 관측할 수는 없다.

## 20년 결과와 카드 기하 보존

DGX `engineB-batch3-20y-7c2a29b`는 exit0으로 끝났다. 1300–1320 미만 seed1/2/3 발생10/12/12건, 응답8/8/9건, 무효2/4/3건이다. 새 API 두 건과 보류 다섯 건은 독립 사건을 추가하지 않는다. 원본7개 원격SHA-256 일치·보고서3개 재생성 바이트 일치를 확인해 `distribution/`에 보관했다. GP7은`measured_not_adjudicated`이다. 최신 본선의 경제 변경 이전 결과이며 최종 병합판 관측으로 주장하지 않는다.

기하 실행 `engineB-batch3-geometry-7c2a29b`도 exit0이다. 해당 이름의 기하 보고서를 함께 보존한다. 본선 카드 변경을 합친 뒤 필요한 관문은 별도로 갱신한다.

## 최신 경제판 통합 뒤 그림·기하

소스19481db3에서 공식 Mac`npm run eventart:auto` 완료: DGX`eventart-auto-19481db`56/56,명령380.1초·exit0,Mac 적용 후7시험 통과. 기하`engineB-batch3-geometry-19481db`는40조건·실패0·미개방0,337.2초·exit0. 이것은 준비 상태 카드 검증이며 변주API 화면 소비나 자연 발생의 증거가 아니다. 최신 경제판20년 실행과 최종 변경 시험·게시 관문은 별도다.
