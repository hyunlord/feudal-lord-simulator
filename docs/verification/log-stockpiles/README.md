# RB-LOGS: 원목 재고 그림 4장

벌목소와 제재소에 **실제 원목 재고가 있을 때** 원목 더미가 생긴다. 여름 계열·겨울 두 계절과 a·b 두 형태, PNG 4장을 설치했다. 건물 ID와 seed로 형태를 정하므로 재고나 계절이 바뀌어도 a/b가 뒤바뀌지 않는다. 원목이 없고 판재만 있으면 새 더미를 그리지 않는다.

제품 `7f3dc1a7`을 HERDS 본선 `ff8f3512`에 합친 `ace906a6`에서 실제 게임을 다시 확인했다. 공용 farm-prop·손수레·UI 부품 계약을 보존하고 stock-pile 종류를 함께 등록했다. 엔진·저장·UI 코드는 바꾸지 않았다.

## 실제 화면과 판정

기준선 `ff8f3512`, 설치 뒤 `ace906a6`에 같은 저장 네 개를 주입했다. 벌목소·제재소 여섯 장면을 줌1.0·0.6·확대3.0으로 확인해 **전후18쌍**을 얻었다. 저장 SHA·전체 게임 상태 SHA·tick·재고·카메라·대상 화면 좌표가 모두 같다([comparison.json](comparison.json)).

- 양성15뷰: 실제 문 옆 기준점의 drawImage 좌표와 파일 이름을 확인했다. 4PNG 모두 실제 게임 그리기로 소비됐다.
- 음성3뷰: 1305년 겨울 제재소는 원목0·판재1이다. 세 줌 모두 대상 위치에 새 원목 호출이 없다.
- b의 따뜻한 그림을 확인한 저장은 **1426년 봄**이다. 겨울은1431년이다. 연도·계절 간 상태가 같다는 주장이 아니라 각 저장의 전후가 같다는 검증이다.
- 건물 그림에 이미 그려진 작업용 목재는 그대로다. 새 더미는 그 고정 그림과 다른 문 옆 위치에 놓인다. 재고0에서도 고정 작업용 목재는 사라지지 않는다. 통나무 그림의 개수를 재고 단위와 일대일로 읽어서는 안 된다.

확대 b 장면은 [이전](captures/before-winter-b-z3.jpg)과 [이후](captures/after-winter-b-z3.jpg)를 나란히 보면 오른쪽 바닥의 눈 덮인 원목이 나타난다. 원본128×128·pivot(64,108)·균일배율0.3을 유지했다. 바닥 alpha 행107은 기준점 바로 위에 있으며 임의 그림 재조립·뒤집기는 없다.

밀집 마을의 a 원목은 앞 교회·집에 가려진다. 이를 없애려고 그림을 앞 지붕 위로 올리지 않았다. 별도 독립 검증의 [겨울 a 외곽 벌목소](captures/independent-winter-a-contact-z3.jpg)에서는 바닥 접촉을 확인했다. 따뜻한 a는 앞집 가림이 남아 완전 노출 접지를 입증했다고 하지 않는다. 줌0.6에서는 그림 폭이 약11–12px로 작아 원목 수·a/b 세부 판독을 주장하지 않는다.

## 실행 증거

- `astra-LOGS-final-before-ff8f351`: 공식 light, exit0,238.6초,18뷰.
- `astra-LOGS-final-after-ace906a`: 공식 light, exit0,238.0초,18뷰.
- 양쪽 page 오류0. 각각18개의 telemetry sample 요청이 페이지 종료 때 ERR_ABORTED로 기록됐다. 모두 `@fls-telemetry/sample`이며 원목 PNG 실패는 없다. 실제 기록은 [before.json](before.json), [after.json](after.json)에 보존했다.
- 이전 독립 검증·오류 감시기 수정·가려진 보충 장면도 [독립 보고서](INDEPENDENT_QA.md)와 [기록](INDEPENDENT_QA_JOURNAL.md)에 남겼다. 판정에 쓴 실행 이름을 보존해 RR15 kept 결과와 연결했다.
- 병합 뒤 원목·목축군·스키마 집중 시험45개, 타입 검사 통과. 최종 기하와 exact-tree test:changed/check:merge 결과는 아래 및 게시 ZIP의 실행 영수증에 기록한다.

## 출처와 재현

[source-registration.json](source-registration.json)은 원본/런타임 SHA를 기록한다. 4장 모두 원본과 바이트까지 같고 caBX가 없다. 생성기록의 tool은 image_gen.imagegen이며 model·seed·정확한 생성 시각은 미기록이다. [generation-records.json](generation-records.json)의 프롬프트·당시 참조 경로·입력 해시는 원본 기록을 보존한 것이다.

전체 저장·모든 캡처·실행 로그는 경량 보고 ZIP에 있다. `repro/` 파일은 저장소 `.omo/log-stockpiles/`로 복사하고 ZIP의 `states/`, `source-inputs/`, `provenance.json`을 같은 폴더에 둔다. 제품/기준선 각각에서 공식 run.sh로 repro/run.sh를 실행한다. prepare.mjs는 생성할 때 쓴 원본 마이그레이션 기록이며 이미 준비한 저장을 두 판에 동일하게 사용한다. 원본 재고·건물·인물을 직접 바꾸지 않는다.

원칙 A4: 기존 재고라는 조건에 반응한다. A5: 같은 저장·좌표·실제 호출을 남긴다. 과장 금지: 가림·작은 줌·고정 작업 목재와 수량 비례가 아닌 그림이라는 한계를 공개한다.

## 최종 게시 관문

공식 관문 실행 `astra-LOGS-geometry-ace906a`에서 화면 4종·80조건을 모두 열어 실패0·미열림0을 확인했다. 입력 해시는 `93fed7094a42ede2ef222bbcc6f105407d72bfbcfa08295fdacdf52afe8a2f85`다. 원목 PNG가 포함된 제품 입력을 측정했고, 이후 변경은 이 출처·장부·보고서 묶음뿐이다.

이 묶음을 커밋한 정확한 tree에서 `npm run test:changed -- --base ff8f35121412b34a9f011f3a35e06e097dec5d13`와 `npm run check:merge -- --base ff8f35121412b34a9f011f3a35e06e097dec5d13 --head HEAD`를 통과한 뒤에만 본선에 올린다. 해당 최종 tree의 시험 영수증과 게시 해시는 ZIP의 gates/runs 및 PUBLICATION.json에 보존한다.


### 첫 관문에서 발견해 고친 의존

`astra-LOGS-final-tests-86f0d14`는 1,656개 통과·1개 실패·9개 건너뜀으로 끝났다. 곡선 땅 기능을 끈 프레임에서도 원목 형태 선택이 경계 모듈의 해시 함수를 호출한 것이 원인이다. 원목 전용 계산으로 의존을 제거했고 경계 모듈을 끈다는 기존 시험은 바꾸지 않았다. 768개 ID/seed 조합에서 기존 형태 선택과 같고, 해당 가드를 포함한 집중 시험15개가 통과했다.

이 첫 실행은 기하 결과의 미추적 하위 폴더도 포함해 제품 tree와 달랐다. 하위 폴더는 보고 ZIP 보관 위치로 옮기고, 최종 실행은 제품 tree와 같은지 별도로 대조한다. 이 실패 실행을 최종 통과 영수증으로 사용하지 않는다.
