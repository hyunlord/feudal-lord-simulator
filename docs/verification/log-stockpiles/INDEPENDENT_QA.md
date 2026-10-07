# RB-LOG-STOCKPILES — 독립 실제 장면 검증

본선 게시 전의 독립 증거이다. 제품 7f3dc1a7과 정확한 부모 8936a469를 비교했다. HERDS 병합 뒤 최종 관문·게시를 대신하지 않는다. 제품 코드·엔진·배우·재고·설치 장부는 이 검증에서 바꾸지 않았다.

## 확인한 것

- 같은 정상 codec 저장 네 개를 사용한 전후 18쌍(각각 줌1.0·0.6·확대3.0). `independent-comparison.json`이 저장 SHA·전체 게임 상태 SHA·tick·재고·카메라·대상 client 좌표·원목 world rect가 18쌍 모두 같음을 assert했다.
- 15개 양성 뷰에서 대상 문 앞 좌표의 실제 drawImage 호출과 정확한 PNG 이름을 확인했다. a 여름/겨울, b 여름/겨울 네 장 모두 실제 게임 소비가 있다. b의 따뜻한 그림은 1426년 봄 저장에서 확인했다. 봄을 여름 저장이라고 부르지 않는다.
- 1305년 겨울 제재소는 logs=0, timber=1이다. 줌 세 단계 모두 원목 draw가 0회다. 같은 화면의 다른 벌목소 원목과 혼동하지 않도록 대상 rect로 구분했다.
- 봄·겨울 b는 같은 제재소 ID와 좌표에서 같은 b 형상을 유지한다. 원목은 기존 제재소의 톱질용 목재와 다른 오른쪽 문 옆에 더해진다. 통나무 모양을 수량 1단위와 일대일로 주장하지 않는다.
- PNG 네 장은 모두 원본 바이트와 같다. 128×128, 원본 pivot(64,108), 균일 배율0.3을 유지한다. alpha>20 실제 그림 폭은 a18.0–18.3, b20.7 world px, 높이는12.6이다. 마지막 유효 alpha 행은107로 pivot보다0.3 world px 위에 있어 별도 부양 간격을 만든 등록은 아니다.

## 육안 판정과 한계

확대 화면에서 b 원목은 바닥 경계에 놓이고 계절 눈 그림을 유지한다. 기존 제재소의 작업용 원목을 그대로 복제해서 같은 자리에 겹친 형태는 관찰되지 않았다. 뒤뜰 밭/정원의 경계가 가까운 기존 도시이므로 여유 있는 독립 야적장처럼 보이지는 않는다.

1305년 벌목소와 제재소 a는 앞쪽 교회·집에 일부/대부분 가린다. 실제 draw 성공을 완전한 가시성으로 바꾸어 보고하지 않는다. 앞 지붕을 뚫고 표시하지 않고 기존 깊이 가림을 유지한다. a 겨울의 접지는 seed5 외곽 벌목소(37,2) 확대 보충 장면에서 확인했다. 봄 저장의 다른 위치(61,11)는 앞집으로 가려져 따뜻한 a의 완전 노출 접지를 별도로 입증했다고 하지 않는다. a 두 계절 원본은 같은 pivot과 바닥 alpha 행을 유지한다.

줌0.6의 원목은 11–12px 안팎의 작은 물건이다. 도시를 가리지 않지만, 이 줌에서 원목 개수나 a/b 형상을 쉽게 읽는다고 주장하지 않는다. 눈·연기·걷는 사람은 렌더 시간에 따라 움직이므로 전후 JPG 전체 해시가 다르다는 사실을 원목만의 픽셀 차이로 해석하지 않는다.

## 실행과 오류 기록

- `astra-LOGS-before-8936a46`: exit0,127.4초. 최초 감시기 baseline. 페이지 오류 감시 연결을 뒤늦게 바로잡았으므로 이 실행의 errors=[]는 무오류 증거로 쓰지 않는다. 원본 결과는 별도 보존했다.
- `astra-LOGS-before2-8936a46`: exit0,127.8초. 수정한 페이지 오류 감시기, 최종 baseline18뷰. 페이지/네트워크 오류0.
- `astra-LOGS-after-7f3dc1a`: exit0,130.0초. 최종 after18뷰. page 오류0. 종료 시 telemetry sample 요청의 ERR_ABORTED1건이 있으며 원목 PNG 실패는 없다.
- `astra-LOGS-contact-7f3dc1a`: exit0,16.5초. 기존 seed5 벌목소(50,9) 확대2뷰. 실제 draw는 맞지만 앞 건물에 가려 접지 증거로 사용하지 않았다.
- `astra-LOGS-contact2-7f3dc1a`: exit0,15.8초. 기존 외곽 벌목소 확대2뷰. 겨울 a는 완전히 드러나 기존 그려진 장작/작업대와 구별되는 오른쪽 바닥에 놓인다. 봄은 앞집 가림을 기록했다.

모두 공식 `scripts/remote/run.sh --light --keep`를 순차 실행했다. heavy/gate 새 등록은 하지 않았다. 원본 PNG/pivot/배율을 고치는 제품 수정은 현재 필요하지 않았다. 최종 병합 뒤 farm-prop·stock-pile 계약을 모두 보존하고 최종 tree 관문을 통과한 뒤에만 게시한다.

## 재현 자료

- `.omo/log-stockpiles/capture.mjs`, `run.sh`, `compare.mjs`, `prepare.mjs`
- `.omo/log-stockpiles/provenance.json`, `states/`, `source-inputs/`, `source-registration.json`
- `.omo/log-stockpiles/independent-comparison.json`, `alpha-contact.json`, `INDEPENDENT_QA_JOURNAL.md`
- baseline: `/tmp/astra-log-stockpiles-before/output/rb-log-stockpiles-before2/`
- after: `/tmp/astra-log-stockpiles/output/rb-log-stockpiles-after/`
- 최초 baseline 보존: `/tmp/astra-log-stockpiles-before-initial-observer/`

독립 판정: 실제 소비·재고 음성·계절·고정 pivot/배율 및 노출된 a겨울/b양계절의 접지는 통과. 밀집 도시의 a따뜻한 그림은 가려짐을 보존한 제한부 결과다. 이를 해결하려고 기존 도시 배치나 깊이 순서를 조작하지 않았다.
