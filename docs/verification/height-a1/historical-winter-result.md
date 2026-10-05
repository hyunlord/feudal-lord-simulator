# HEIGHT A1 BEFORE/AFTER v2 runtime 결과

**제한된 A1 runtime 관문 PASS.** BEFORE16 × 독립 A/A와 AFTER16 × 독립 A/A, 총64 opens가 오류0으로 완료됐다. 양쪽 제품은 cd399e4a 기반이며 AFTER의 승인된 composer1+test2 patch는 처음 승인본과 byte 동일하다. main 제품/PNG/catalog/ledger/commit을 변경하지 않았다. 기존 v1의 실패는 실패로 보존했다.

| 검증 | 결과 |
|---|---|
| BEFORE run | `astra-height-a1-before-full-v2-cd399e4`, exit0, 준비6.7초/queue0초/command300.6초 |
| AFTER run | `astra-height-a1-after-full-v2-cd399e4`, exit0, 준비6.8초/queue0초/command314.0초 |
| 공유 runner | 각각 status 확인 후 순차 제출, heavy slot1/2, port4300 |
| 전체 presented state | raw64개가 해당 production expected JSON과 byte exact, resident 포함 |
| 엔진 입력 | 원래 save2 유지, 주입 전 save bytes SHA 및 전체 admitted engine SHA 관문 통과 |
| PNG | 로컬 decode RGBA64개가 receipt와 일치, 독립 A/A32쌍 exact |
| BEFORE/AFTER identity | 16쌍에서 의도한 composerSHA 이외 전부 동일 |
| pose/view/readiness | 16쌍 entire heightEvidence 동일: 실제 walker/appearance/gait/direction, camera/DPR/center, composedReady |
| asset4 | request/decode/paint lineage 관문 통과; 최종 visible contact 보장으로 해석하지 않음 |
| freeze | 회수 후 양쪽1795 common pins 및 composer variant PASS |

전체 engine store를 runtime에서 별도로 읽었다고 주장하지 않는다. 주입된 엔진 원문을 검증하고, 실제 proof가 반환하는 전체 presented state를 production 기대값과 대조했다.

## Native 관찰 — 전체32 view의 target 주변

총32개 first capture에서 같은 source rectangle을 추출한 무보간 native crop을 8개의 비교 sheet로 검사했다. repeat32는 exactRGBA로 동일함을 검증했고 별도의 육안표본으로 세지 않는다. DPR1 crop200×175, DPR2 crop400×350이고 source pixel을 resize하지 않았다. 라벨은 crop 밖의 패딩에만 있다. 모든 crop은 원본 해당 RGBA rectangle과 byte 동일하다. 전체 canvas의 모든 픽셀을 육안 정밀 판독했다는 뜻은 아니다.

- **gait0, zoom2/DPR2:** 동일 회색 logger의 머리·상체·다리/발·빈 cart가 읽힌다. AFTER의 figure와 cart가 함께 커져 있고 source/camera/pose는 동일하다. body/foot/cart의 상대 위치를 비교할 의미 있는 장면이다. 손은 cloak/prop/shaft 근처 겹침 때문에 해부학적 grip 접촉을 확정할 수 없다.
- **gait1, zoom2/DPR2:** target body와 노출된 다리/발이 보인다. 오른쪽 다른 인물이 팔·수레 주변 일부를 가린다. 추가 인물도 A1 영향을 받을 수 있고, 실제 state에서 제거하지 않았다. target 대신 다른 actor를 측정하지 않았다.
- **zoom1/DPR1·2:** 두 gait의 target/body/cart 형체와 확대 변화는 비교 가능하다. 세부 손 접촉·발 sole의 anatomy는 불확실하다.
- **zoom.5/.6, DPR1·2:** 두 gait 모두 native 크기가 작다. silhouettes와 위치 검사는 가능하나 미세접촉 수락은 불가하다. A2 zoom-floor 정책은 변경하지 않았다.

32 target crop에서 그림의 누락이나 완전히 다른 actor로 바뀐 현상은 관찰하지 않았다. 이는 접촉 전체 PASS가 아니다. pixel 차이는 각view173–16977개이며 target뿐 아니라 같은 frame의 다른 실제 인물도 포함할 수 있다. 16개 diff bbox/count는 `status.json`에 기록했다. 신체 segmentation 없이 diff bbox를 키/발 측정치로 사용하지 않았다. 발의 렌더 픽셀은 기존 gait-lift/rounding 영향도 받으므로 engine anchor 불변만으로 화면 발이 동일하다고 주장하지 않는다.

## 남은 수락 경계

이 실행은 실제 winter carter1명의 SW gait0/1, empty outbound fetch, camera.5/.6/1/2, DPR1/2에 대한 A1 관문이다. **17.6 barefoot crown-to-sole 실측, 23개 문, 양손/grip 및 모든 접촉, held8 등록, loaded cart, bier, summer, 다른 방향, 모든 body pool/독립 story·crowd 조건은 미수락**이다. gait1은 실제 추가 인물 가림도 남는다. source metadata와 필요한 후속 장면 없이 이 결과를 전체 art등록/설치 PASS로 확대하지 않는다.

## 증거

- `status.json`: raw64/PNG64 원본 경로·SHA,16차이,32 native crop 경로·SHA·가시성 판정.
- `before-captures.json`, `after-captures.json`, 각 run.log/timing.env/exit-code.
- 원본은 각 isolated checkout의 `output/height-a1-runtime-v2/captures-{before|after}-full/`에 보존.

- [gait0 zoom0p5 native 비교](/Users/rexxa/fls-astra-renderB-height-prep/output/height-a1-runtime-v2/comparison/comparison-g0-z0p5-native.png)
- [gait0 zoom0p6 native 비교](/Users/rexxa/fls-astra-renderB-height-prep/output/height-a1-runtime-v2/comparison/comparison-g0-z0p6-native.png)
- [gait0 zoom1 native 비교](/Users/rexxa/fls-astra-renderB-height-prep/output/height-a1-runtime-v2/comparison/comparison-g0-z1-native.png)
- [gait0 zoom2 native 비교](/Users/rexxa/fls-astra-renderB-height-prep/output/height-a1-runtime-v2/comparison/comparison-g0-z2-native.png)
- [gait1 zoom0p5 native 비교](/Users/rexxa/fls-astra-renderB-height-prep/output/height-a1-runtime-v2/comparison/comparison-g1-z0p5-native.png)
- [gait1 zoom0p6 native 비교](/Users/rexxa/fls-astra-renderB-height-prep/output/height-a1-runtime-v2/comparison/comparison-g1-z0p6-native.png)
- [gait1 zoom1 native 비교](/Users/rexxa/fls-astra-renderB-height-prep/output/height-a1-runtime-v2/comparison/comparison-g1-z1-native.png)
- [gait1 zoom2 native 비교](/Users/rexxa/fls-astra-renderB-height-prep/output/height-a1-runtime-v2/comparison/comparison-g1-z2-native.png)
