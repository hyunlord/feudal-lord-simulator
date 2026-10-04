# R08 장기 자료 인계 최소안 — 복사 전 제안

**권고: core 127파일/54,990,034바이트(약 52.44MiB)를 선택한다.** 과거 5개 완주 판의 시작·최종 저장, 연간·명령 로그, 식별/종료/codec 기록과 선별한 표·SVG·독립 검수다. 이번 작업에서 복사·시뮬레이션·engine decode·브라우저 실행은 하지 않았다. COPY_CANDIDATES.json/.csv에 각 원본 절대경로, R08 제안 상대경로, SHA256, 크기와 이유가 있다. 부모가 선택하고 복사할 목록이다.

전달 경로는 `inherited/R07/...`로 분리해 새 R08 결과와 구분한다. 그 안의 오래된 판도 실제 실행 출처 R03/R04를 보존한다. R07 폴더에 없는 옛 최종 저장을 R07에 이미 포함된 것처럼 쓰지 않고 원래 R03/R04 경로에서 읽었다. exact source mapping이 목록에 있다. 읽은 기존 문서의 시대별 표현은 변경하지 않는다.

## 실제 범위 지도

| 판 | 실행 출처 | seed / 땅 | 방침·관측기 계약 | 연말 관측 | 최종 인구 / 보존 사망 |
|---|---|---|---|---:|---:|
|N02-v3-open-1-growth|R04|1 / open_field|v3 fixed growth, 인수 적용|150|520 / 5,440|
|N03-v3-open-1-stability|R04|1 / open_field|v3 fixed stability, 인수 적용|150|528 / 2,167|
|N04-chalk-2-full|R03|2 / chalk_downs|v2 full, growth 인수 미적용, 동적 방침|150|762 / 3,083|
|seed3-open-fixed-growth|R07|3 / open_field|v3 fixed growth, 인수 적용|150|768 / 2,904|
|seed3-open-fixed-stability|R07|3 / open_field|v3 fixed stability, 인수 적용|150|640 / 2,236|

5판 모두 HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742`, metadata의 source 9핀 집합도 같다. 직접 JSON 검사에서 시작0·끝600000틱, 1300~1449 기간연도와 1301~1450 연말 경계의 각150행 연속성이 확인됐다. 750개의 연간 구간이다. 최종 persons.past의 !alive ID 중복0도 재확인했다. 이 표는 이전 실행 750년의 승계 관측이지 R08에서 750년을 돌렸다는 뜻이 아니다.

seed2는 시작 growth지만 종료 revenue다. commands.jsonl의 set_estate_policy 5건은 모두 참조 변경 true며 tick 32059/60061/72073/224095/439141이다. 이것이 모든 방침 변화의 완전 목록이라는 뜻은 아니다. 중간 controlsBefore에는 defence도 있다. full 모드·다른 지형·다른 seed·v2 프로토콜이 함께 달라 seed1/3 고정판의 대조군으로 쓰지 않는다.

범위는 seed 3개·땅 2종·고정 방침 2종 및 동적 full 1판이다. 다른 땅, 모든 seed, fixed revenue/defence, seed2의 성장/안정 쌍은 없다. 125년 표본을 새로 추가할 필요 없이 이 목록의150년 판은125~150년 요청 범위의 상단을 충족한다. 이것은 신규 R08 실행 목표를 자동 대체한다는 결정이 아니라 부모가 채택할 승계 범위다.

## 최소 묶음과 선택 확장

- **core 127파일:** 5판 각각 metadata/summary/years/commands/controls/save-checks/start/final/종료/시간/역사SHA와 있는 registry 기록. 선별한 정책쌍·현금·성장·명령밀도·세력/직업 표면·기록사망 보고서와 데이터, SVG4개, 관련 독립 검수·검산 결과를 포함한다. 최종 ledger와 persons를 실제 저장으로 다시 확인할 수 있다. HTML/PNG/JPEG/브라우저 프로필은 없다.
- **checkpoint_extension 25파일/126,282,559바이트:** 각 판1325/1350/1375/1400/1425 저장이다. “중간 사망 ID가 최종에도 모두 남는다”, 중간 소유자·집 상태 등 체크포인트 기반 문장을 독립적으로 다시 검산하려는 경우 선택한다. 기본 core는 그 검산 결과·입력 해시·한계를 승계하며, 중간 원본을 포함했다고 주장하지 않는다.
- **latest/year1450 10파일:** OMITTED_DUPLICATES.json에서 실제 파일 SHA와 final의 바이트 동일 여부를 기록했다. final만 core에 남긴다. 동일 tick만으로 동일 바이트를 추측하지 않는다.
- **기타 제외:** 이전 UI 스크린샷 전체, 원격 환경 로그 전체, 중복 PNG 그래프, synthetic checker fixtures는 이 A 인계에 필요하지 않다. checker 양성/음성 판정과 범위 보고는 남긴다. 이전 전체 REPORT는 관계없는 작업과 링크를 대량 끌어오므로 본 범위 지도와 선별 보고서가 입구다.

“self-contained”는 이 선정 범위의 결과·연간곡선·명령·최종 현금·보존 사망을 판독/재집계할 수 있다는 뜻이다. 전체 엔진 replay 번들, 과거 모든 checkpoint의 재decode, 모든 과거 문서 상대 링크의 closure를 뜻하지 않는다. 원래 절대 경로·historical SHA 목록·일부 이전 그래프 안내는 출처 기록이다. 일부 역사 manifest가 생략한 latest/checkpoint 등을 가리키므로 배포시 root manifest를 현재 포함파일로 새로 만들고 역사 manifest를 완전 현재목록으로 검사하지 않는다. 원래 스크립트의 절대 입력경로를 수정해 새로 실행한 것처럼 만들지 않는다.

## 사실 한계를 같이 전달할 것

사망은 각 판 persons에 기록된 고유 ID·연도·원인이다. 지도 밖 모든 사망·사망률·노출인년은 아니다. age에는 어린이 및 이주 후 사망도 있어 노환으로 번역하지 않는다. person.died가 없는 일부 age를 기록 누락 버그로 부르지 않는다. R06 long-run-surfaces의 보수적 사망 문구는 이후 R07 death-coverage 보고가 기록된 인물 범위에서 보강한 것이며, 세계 전체로 넓힌 결론이 아니다.

명령 시도/next!==state는 사람이 느끼는 재미나 의미 있는 선택과 같지 않다. 정책쌍도 혼인·사건·영지 경로가 달라 직접 정책 수익을 분리할 수 없다. seed3 금고 차이403,127d는 범주 대사는 되지만 오래된 rollup의 영지별·청원별 출처는 압축돼 있다. codec38건의 latest는 덮어써졌으므로 과거38개 저장 파일을 독립 복원한 것은 아니다. 이 한계들을 지워서 작은 ZIP으로 만들면 안 된다.

검증 산출은 COVERAGE.json, RESULT.json, COPY_CANDIDATES.json/.csv, OMITTED_DUPLICATES.json이다. inventory.rb는 경량 JSON/SHA 읽기로 목록만 만들며 복사 명령이 없다. SOURCE 선택은 SHA로 고정됐고, 부모 복사 시 현재 SHA가 달라지면 재분류해야 한다. 아직 납품 ZIP이나 staging은 만들지 않았다.
