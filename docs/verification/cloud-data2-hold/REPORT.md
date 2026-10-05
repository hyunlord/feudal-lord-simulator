# CLOUD DATA2 HOLD

**HOLD — 승인된 alpha .12에서 실제 구름 그림자의 형태를 안정적으로 읽을 수 없어 DATA 시각 관문 실패.**

승인된 원본 그림 자체를 거절하거나 재제작하는 판단이 아니다. 이 소비자의 등록·고정 opacity 정책과 결합한 runtime candidate N0354/N0355를 보류한다. 정본 통합 대상은 CORE 기존 Wave23 old2이며 DATA2를 게시·설치 승격하지 않는다. 격리 후보 HEAD66b8에는 PNG2/catalog/provenance candidate가 남아 있으므로 이 전체 트리를 정본으로 복사해서는 안 된다. 이 패키지는 제품 또는 장부 상태를 변경하지 않는다.

## 실제 이력

| 단계 | 실제 HEAD | 결과 |
|---|---|---|
| CORE10 | cd24d50c5ff3f7df35fbf1849d11da67cfd137b9 | 별도 CORE actual/독립 native PASS; 비교 기준 |
| CORE 공식 증거 | 35a66f266cd51aaa9526123c419b275b32af581c | 문서26만 추가한 역사적 커밋 |
| DATA v1 | 66b8e1ef2d5e4e9ec8d610cc21c583fbfd56bf6b | exit1, actual10/A-A10, late native observer 우회16오류 |
| DATA v2 | 동일66b8 | exit1, actual10/A-A10, zoom.6 Float32 transform oracle8오류 |
| v3 | 같은 제품66b8의 별도 준비물 | 좁은 oracle 보정과 독립 준비검토 승인, **실제 실행 안 함** |

원래 v1/v2 FAIL을 뒤늦게 PASS로 고치지 않았다. v2의 실제 source/crop/destination/alpha/blend/time은 회수 후 exact 확인되고 transform은 수학적 double/Math.fround 표현으로 설명됐다. 이는 실패 oracle의 진단이지 원래 실행의 성공 판정이 아니다. v3를 같은 그림으로 다시 촬영해 oracle만 초록색으로 만드는 작업은 진행하지 않는다.

## 시각 판단과 한계

[독립 검토](native-review.md)는 CORE before10 + DATA after10 원본 PNG를 개별로 열었고, actual positive8 모두 .12에서 구름 그림자 형태를 신뢰할 만큼 식별할 수 없다고 판정했다. negative2 보존, A/A10, positive8 픽셀 변화는 가시성 승인과 다르다. [부모6장 표본](parent-six-native.json)도 after4/before2에서 동일 한계를 관찰했다. 초기에 작성된 부모 표본의 “independent pending” 문구는 당시 역사 그대로 두었으며, 최종 판정은 뒤의 독립 전체20장 검토와 현재 HOLD다.

원본512×256, pivot256/128, encoded alpha0..35를 그대로 보존했다. lower/upper world width614.4/819.2, uniform1.2/1.6, height307.2/409.6, globalAlpha .12 및 cap380/normal/기존 속도 정책을 변경하지 않았다. 최대35/255×.12≈1.65%/deck이다. 임의 alpha/RGB 증폭·deck 추가·원본 변형·날씨 조건 확대는 하지 않는다. [source2/등록](source2-registration.json)에 받은 원본 SHA와 과거 생성 원시 SHA를 구분했다.

**Performance NOTVERIFIED.** 동결된 JS clock, 호스트 command elapsed, 독립 page open은 renderer cold/warm P95의 증거가 아니다. 자연 플레이·모든 가림·일반 사용성 승인도 아니다.

## 실제 이미지

아래 JPEG는 원래 capture의 byte-identical 사본이며 다시 저장/확대/보정하지 않았다. native 판정은 외부 원본 PNG20개에 근거하며 [native20 index](external-native20-index.json)에 실제 경로/HEAD/SHA를 보존했다.

| 조건 | DATA v2 | CORE before |
|---|---|---|
| 여름1 | [after](previews/after-summer-normal-z1-t0.jpg) | [before](previews/before-summer-normal-z1-t0.jpg) |
| 여름.6 | [after](previews/after-summer-normal-z06-t0.jpg) | 외부 native index |
| 겨울1 | [after](previews/after-winter-normal-z1-t0.jpg) | [before](previews/before-winter-normal-z1-t0.jpg) |
| 겨울.6 | [after](previews/after-winter-normal-z06-t0.jpg) | 외부 native index |

## 증거 포장

- [v1 원본 결과](v1-historical-result.json), [v2 원본 결과](v2-historical-result.json), 각 raw75 index가 모든 실제 원본 파일을 결박한다. 과거 MD의 절대 경로와 당시 상태 문구는 역사 보존이다.
- `v1/v2-{pre,post,final}.json.gz`는 원 영수증을 gzip mtime0으로 무손실 포장했다. 압축해제 SHA/원경로는 [artifact copies](artifact-copies.json)에 있다. 원 pre/post 각각1.18MiB와 capture JSON 각각11MiB 이상이라 ≤3MiB 패키지에 PNG20/전체raw를 중복하지 않았다. 외부 원본은 kept run 및 격리 output에 보존한다.
- [v3 준비](v3-unexecuted-prep.json)·[독립 준비검토](v3-preparation-only-review.json)는 **NOT RUN**이며 actual PASS가 아니다.
- `SHA256SUMS.json`은 자신을 제외한 이 디렉터리의 모든 파일을 정확히 열거한다. 패키지 총크기/인덱스 자체SHA는 외부 prep 영수증에 기록한다.

provenance candidate/installed_by blank를 유지한다. 본 패키지에서 제품·원본·runtimePNG·CSV·ledger·STATUS/ROADMAP/DISPATCH·commit·remote 실행을 하지 않았다. 다음 변경은 별도의 명시적 판정과 승인 없이는 수행하지 않는다.

출판 사본 링크 보정: `native-review.md`의 JSON 링크 1개만 `cloud-data2-v2-native-review.json` → `native-review.json`으로 바꿨다. 외부 원본 SHA `934c6295eeb97dcefa7a51368f46fcc3f7514082c61d089dd461f3b35e47c4f6`는 보존하며 정확 변환과 사본 SHA는 artifact-copies.json에 기록했다. 본문/판정은 동일하다.
