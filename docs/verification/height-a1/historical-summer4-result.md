# HEIGHT 여름 적재4방향 — 제한된 실행 결과

**숫자 계약 PASS / native 주변8개 확인 / 손–손잡이 접촉 UNCERTAIN.** 승인된 두 run만 순차 실행했다. BEFORE PASS를 로컬에서 확인한 뒤 AFTER를 제출했다. 제품 설치·main 전송·commit·새 PNG 제작·추가 재촬영은 없다.

| 실행 | 공식 runner / 결과 | queue / command |
|---|---|---|
| BEFORE | `astra-height-summer-before-v1-cd399e4`, exit0 | 0.0s / 140.7s |
| AFTER | `astra-height-summer-after-v1-cd399e4`, exit0 | 0.0s / 134.5s |

둘 다 `--heavy --detach --keep`, shared 최대2-slot FIFO를 사용했다. 단독 watcher/fetch로 각26개 결과 파일을 받았다. `before-attach.log`, `after-attach.log`에 실행·fetch 기록이 있다.

## 동결 및 숫자 증거

BEFORE HEAD `cd399e4abb26fc04b37dc27b5c61bec270934a7d`, tracked diff0. AFTER는 같은 HEAD + 승인된 composer1/test2 원래 patch이며 정확한 diff SHA를 pre/post 비교했다. 각26,706 tracked 파일 + 원래10개 신규 하네스/fixture 파일의 실행 전후 SHA가 동일하다. 원격 export 전 파일도 각각26,933/26,882개를 start/end에 로컬 및 preflight와 비교하여 누락·불일치0이다. export 수 차이는 격리 트리의 기존 진단 산출물 차이이며 제품 변경 개수가 아니다. `*-preflight.json`, `*-{start,end}-export.json`, `local-postflight.json` 참조. 기존 v1/v2 입력은 export 안에서 그대로 고정되어 있고 이번 실행에 덮어쓰지 않았다.

원문 `chapter-two-town.save.json` SHA `203f2393fb2fb363cf93d0737e55a5afde5b92bf41f81c29740e6d4a83434102`, tick77500/여름/engine25를 그대로 주입했다. 전체 production presented46명을 유지했고 actor·resident 제거/정렬/mission·cargo·gait 편집이 없다.

- engine 전체 SHA `776708fcc47c4f8e1d4bde626c4165b6b8cf6c2aa5f6073f5ad25644f0343ca5`.
- production presented 전체 SHA `8cbff37d92638e01176a2103dea4aaffeea452508c1e9ac2520450d65e1305d7`.
- 8뷰/16 opens, 독립 A/A8쌍 exact. 로컬에서16 PNG의 RGBA SHA와16개 raw presented JSON 전체 SHA 및46명 수를 다시 확인했다.
- 각 실제4 ID/cargo/pose/appearance/cargoArt/readiness, zoom2/DPR2/1600×1100,필수 body/cart/payload request+decode+paint lineage, 안정 canvas, 오류0.
- BEFORE/AFTER4쌍 identity는 의도한 composer SHA만 다르고 `heightEvidence` 전체는 같다. 네 전체 RGBA는 변경되었다. crop 변경 pixel 수 NW10072/NE13621/SW3850/SE10438은 주변의 다른 actor도 포함하며 target 단독 크기 실측이 아니다.

`numeric.json`, 각 `*-captures.json`, 재검산용 `compare.py`가 근거다. 전역 canvas paint lineage는 특정 target의 최종 노출 pixel을 증명하지 않는다. 네 방향은 서로 다른 실제 carter이고 모두 gait0이며 같은 사람을 회전시킨 실험이 아니다.

## native 검토 — 부모 독립 열람 index

정확8개 crop/source 경로·SHA·source 좌표는 **`native-index.json`**. 원본은 각 트리 `output/height-a1-summer-loaded/captures-{before,after}/summer-loaded-{nw,ne,sw,se}.png`이며3200×2200이다. 모든 crop은 source `[1400,850,1800,1200)`의400×350 RGBA를 무보간 복사했다. source crop와 저장 crop의 RGBA 일치를8/8 직접 재검산했다.

paired sheet4개는 AFTER 트리 `output/height-a1-summer-loaded/comparison/summer-loaded-{nw,ne,sw,se}-paired-native.png`. BEFORE는(0,30), AFTER는(400,30)에 배치했고 라벨은 pixel 영역 밖이다. 이4장을 모두 열어 양쪽8개 native 주변을 검토했다. 원본 전체3200×2200의 모든 픽셀을 사람이 정밀 검사했다는 뜻은 아니다.

| 방향 | 관측 | 한계/판정 |
|---|---|---|
| NW | 사람 몸통·다리와 grain cart 일부가 양쪽에서 보이며 AFTER의 figure/cart 증가를 비교할 수 있다 | 현장 안내 말풍선이 cart 우측/하부 일부를 가리고 건물·근처 actor가 함께 있음. 정확한 grip 접점 UNCERTAIN |
| NE | bridge 옆 사람들과 timber cart 주변을 비교할 수 있다 | target 주변에 실제 다른 actor가 겹치고 bridge/주변 물체가 일부 영역을 가림. target 단독 손·발과 인접 actor를 모든 픽셀에서 분리 증명하지 않음. grip UNCERTAIN |
| SW | 지붕 뒤 머리/상체 일부와 grain cart 상부가 양쪽에서 보인다 | 하체·발 및 접촉 영역이 전경 지붕으로 가려짐. 숨겨진 접촉 성공/실패를 판정할 수 없음 |
| SE | grain/timber cart와 여러 인물이 섞인 주변을 확인했다 | 큰 목재 안내 말풍선·서로 가까운 cart/actor 때문에 개별 화물/몸의 최종 pixel 귀속을 완전히 분리할 수 없음. 다른 몸을 target 대역으로 수락하지 않음. grip UNCERTAIN |

추가 `nearby-actor-anchors.json`은 **실제 presented state와 production projection 수식**에서 계산한 인접 actor ID/화물/명목 foot anchor를 보존한다. draw trace나 authored anatomical 측정이 아니다. 전체 상태 target 사실과 주변의 특정 노출 몸을 자동 동일시하지 않는다. SE의 추가 nearest4x crop은 라벨을 밖에 두고 source `[1550,1000,1650,1150)`를 무손실 정수 확대했지만, 다른 actor의 접촉을 target 접촉 증거로 바꾸지 않는다.

현재 관측에서 새 접촉 regression을 확정할 증거는 없다. 이는 모든 접촉이 정상이라는 의미도 아니다. 이 run은 여름 적재4방향의 상태·선택·로딩·안정 렌더와 제한된 가시성을 보강하며, barefoot17.6 실측·모든 연령/군중·held8·bier·문23 완료는 아니다.

## 요청된 다음 최소 범위 — 아직 실행하지 않음

여름 zoom1/.6은 **동일 원문 save와 NW 실제 ID/동일 camera tile(50.979999999999976,38)**를 재사용하는 두 view로 준비 가능하다. 제품 변경은 필요 없다. BEFORE2→AFTER2,각 독립 A/A이면4 actual views/8 opens가 최소 후속이다. 현재 v1의10파일/4views/zoom2 동결을 바꾸지 않고 별도 output 폴더·전용2view validation·pins를 만들어 독립 리뷰해야 한다.

각 view는 모든46명과 whole engine/presented SHA, 실제 cargo wheat12/returning/gait0/body/prop/cloak를 그대로 유지한다. zoom1에는 body/cart/payload lineage를 요구할 수 있다. zoom.6에서는 `CART_LOAD_MIN_ZOOM=.8`에 따라 payload **draw가 의도적으로 생략**되므로 payload paint를 요구하면 잘못된 계약이다. 실제 cargo/cargoArt는 그대로 확인하되 body/cart draw와 low-zoom floor `.65`를 검증하고, payload 부재를 화물 없는 mission으로 바꾸지 않는다. 해당 LOD 기대값은 신규 하네스의 mutation negatives와 함께 명시해야 한다. 기존 겨울 v2 zoom1/.6 증거를 수정하거나 재촬영할 이유는 없다. 이 제안은 추가 DGX 제출 승인이 아니다.
