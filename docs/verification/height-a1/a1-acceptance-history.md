# HEIGHT A1 수락 범위 독립 검토

**좁은 A1 증거는 수락 가능하다. 본선 적용 완료 판정은 exact source 이관과 여름 두 뷰 관문 뒤에 한다.** 기존 등록 높이16→17.6의 상수 연결을 authored barefoot 측정, A2, 군중, 문23 완료와 혼동하지 않는 조건이다. 부모의 겨울16/16·여름4/4 숫자/native 판정은 `PASS_BOUNDED_A1_VISIBILITY_ONLY / contact UNCERTAIN`으로 그대로 유지한다. 해부학 metadata 전체가 없다는 이유로 이 좁은 변경을 전부 차단할 근거는 없다.

## 현재 무엇을 수락할 수 있는가

격리 `cd399e4abb26fc04b37dc27b5c61bec270934a7d`의 실제 diff는 composer1 + test2다. `walkerComposer.ts:31`의17.6 정본과 `/32` 호환 배율만 제품 변경이며 source frame·foot·hand·prop·cloak anchor, engine actor, 카메라 정책을 바꾸지 않는다. 기존 두 테스트의16 기대를17.6으로 맞추고 실제 actor destination의 모든 frame에10% 확대/foot 보존 검사를 추가했다. broad consumer rewrite나 새 module은 필요 없다.

- 겨울은 동일 실제 SW carter 두 gait, zoom.5/.6/1/2, DPR1/2에서 full presented identity 및 variant별 A/A, bounded native 형체 비교가 있다. 확대 후 다른 actor로 바뀜/통째 누락은 관찰되지 않았다.
- 여름은 unmodified chapter-two-town의 서로 다른 실제 loaded carter4방향, gait0, zoom2/DPR2에서 같은 사실과 카메라를 비교했다. 이는 겨울 empty/SW에 없던 loaded 및 방향 범위를 보완한다. 모든 방향의 같은 actor나 모든 gait 증거는 아니다.
- 따라서 “시험한 상태에서 의도된 확대와 actor/cart 존재·가시성이 유지됨”은 수락 가능하다. “신규 손·짐 접촉 회귀가 전 조건에서 없음”, “맨발17.6 실측”, “전체 HEIGHT 완료”는 불가하다. native contact UNCERTAIN은 관찰된 실패도 접촉 성공도 아니다.

## 손·짐 접촉에서 소스가 보장하는 것과 보장하지 않는 것

`walkerComposer.ts:227`은 body/held prop/cloak가 합성된 같은 cell에 `32*scale/frame.figureHeight`를 적용한다. 동일 frame 안에서 손–소품 등록을 따로 이동시키는 변경은 없다. `runtimeActorAssets.ts:100`의 cart 크기와 handle offset도 같은 scale에 비례하며 `drawWalkers.ts:129` payload는 cart rect에 비례한다. 따라서 gait0의 연속 좌표상 body/cart/payload는 같은 foot 중심의1.1 확대다. 기존 틈까지 없어지는 것은 아니며, 원래 gap도10% 확대될 수 있다. 실제 device pixel 반올림·샘플링·가림 때문에 이 대수적 보존만으로 시각 접촉 회귀0을 증명하지 않는다.

특히 `walkerPresentation.ts:69`의 gait1 lift는 device pixel로 반올림하고, `drawWalkers.ts:164`는 body만 lift한다. cart는 lift하지 않는다. 정책은 불변이나17.6 입력 때문에 특정 zoom/DPR에서 반올림 결과가 달라질 수 있다. 겨울 두 gait 행렬이 관련 bounded 증거이고, 손을 가린 다른 actor를 제거해 인위적으로 PASS를 만들면 안 된다. 현재 자료에서 확정 신규 접촉 결함은 없지만, 판독되지 않은 접촉은 계속 UNCERTAIN이다.

이번 검토에서 여름 NE/NW native paired sheet 두 장을 직접 다시 열었다. NE는 몸/수레/목재 실루엣은 비교되지만 다른 인물·다리와 겹치며, NW에는 라벨 가림이 있다. 부모의 contact 한계와 일치한다. 전44뷰 독립 재검수를 했다는 주장은 하지 않는다.

## 최소 추가 관문: 여름 두 뷰를 이관 검사와 합치기

여름은 zoom2만 있어서 보통 화면과 low-zoom에서의 가독성 사실이 비어 있다. 기존 full 행렬 반복 대신 **같은 NE target 두 뷰**를 권고한다. checked-in `chapter-two-town.save.json`, tick77500, actor `carter:construction-site-000006:77441`, timber2/outbound/NE/gait0, tile `(48,35.73999999999997)`, 전체 production presented46명을 그대로 사용한다.

1. zoom1 / DPR1 / 1600×1100: body·cart·목재가 일반 화면 크기에서 읽히는지, 새 누락·심한 분리·가림 악화가 관찰되는지 before/after 비교한다.
2. zoom.6 / DPR1 / 같은 viewport·중심: 기존 .65 floor에서 형체/방향과 body-cart 연결의 거친 가독성을 비교한다. 등록 figure의 명목 화면높이는 종전10.4→11.44px이며 anatomical 실측값은 아니다. 기존 payload LOD는.8이므로 **이 뷰의 짐 paint는 없어야 정상**이다. 실제 cargo 사실과 preload/readiness는 그대로 보존하되 payload paint를 필수로 강제하는 기존 zoom2 expectation을 복사하지 않는다.

각 view를 BEFORE/AFTER 독립 A/A로 실행하면4 first captures, 총8opens다. 상대 gait나 source 변경, engine tick, actor removal, mission 조작은 필요 없다. 새 view contract는 기존 v1/v2 pins를 덮지 않는 별도 descendant로 고정하고, 요청/decoded/paint의 LOD 기대를 검토한 뒤 실행한다. 눈으로 읽지 못한 손 접촉을 이 두 작은 뷰에서 억지로 수락하지 않는다.

**이 두 뷰를 현재 main baseline과 A1 적용 candidate의 비교로 사용하면 여름 빈칸과 본선 이관 검사를 함께 닫을 수 있다.** isolated에서 동일두뷰를 먼저 반복하고 다시 본선에서 같은 행렬을 수행할 필요는 없다. 실제 native에서 새 거친 분리/소실이 드러날 때만 해당뷰를 좁게 조사한다. 카메라 변경으로 scene상의 실제 actor 상호 가림이 사라진다고 가정하지 않는다.

## commit/exact source와 이관 수락

- 과거 증거는 cd399 HEAD 단독이 아니라 당시 composer patch를 포함한다. 실제 AFTER composer SHA `63bcc341d0b8a95ddaac7ae82e038f430757afd3e1d1fe31f46d388166cc279f`와 test2 SHA, 기존 harness/source pins 및 before/after export를 actual commit/tree에 연결해야 한다. 단순 commit 생성 때문에 픽셀 검증 전체를 반복할 필요는 없지만 동일 byte 증명이 필수다. 과거 working-tree capture를 clean-commit capture라고 이름 바꾸지 않는다.
- 본선의 실제 기준 HEAD를 먼저 고정하고 composer의 최소 semantic delta만 적용한다. 옛 catalog/loader/원본/장부나 전체 checkout을 복사하지 않는다. 기존 source consumers의 현재 diff, tests의 현행 의미, public/assets·관련 manifest 보존을 확인하고 unowned 변경0을 guard한다. 본선 commit 후 source SHA·patch 대응을 기록한다.
- HEIGHT 집중 테스트(배율/실제 frame foot destination 및 composer·presentation·cart·story scale 관련 기존 회귀)와 필수 type/lint를 현재 source에서 확인한다. 기존 통과 suite를 변화 없이 무작정 확대 반복하지 않는다.
- 위 두뷰의 actual main baseline/candidate full identity(허용 product delta만), source/export pins, native assets readiness, errors0, variant별 A/A와 무보간 native 비교를 통과하면 좁은 A1 본선 수락이 가능하다. 관련 human consumer가 역사 snapshot 이후 의미 있게 달라졌다면 그 경로에 필요한 겨울 한 뷰를 추가하고, 그렇지 않으면 기존 겨울16증거를 유지한다. 알려지지 않은 future HEAD 동일성을 미리 주장하지 않는다.

## 별도 미완료의 경계

`render-human-registration-request.md`의 child/elder8·crowd1·bearer/bier3는 source registration B다. 군중0.55는 독립이고 ordinary child의 자기 figureHeight 정규화는 기존 의미다. A2는 story/ordinary 저줌 정책 차이이며 이번에는 floor.65를 바꾸지 않는다. bearer는17.6/65로 변하지만 bier.65는 불변이므로 별도 joint-contact risk와 실제 arrival witness 요구를 보존한다. 이를 관찰된 A1 회귀로 단정하거나 모든 인체 metadata의 선행차단으로 확대하지 않는다.

문23 요청은 실제 개구부/레이어 제작·설치·runtime 대기다. 사람 확대는 기존 작은 문 비례를 해결하지 않고 그 비율을 더 낮춘다는 점도 유지한다. 17.6을 다시 낮추거나 건물 전체를 늘리는 것을 A1 대안으로 권하지 않는다. B/A2/C 및 held8/bier 별도 과제는 좁은 A1 수락 후에도 HEIGHT 전체 미완료로 남는다.

산출은 본 MD/JSON뿐이다. 제품·공식 요청·fixture 변경, 새 테스트/브라우저/원격/commit 실행은 없다. Graft caller는 실제 source로 재확인했다.
