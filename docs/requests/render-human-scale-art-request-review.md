# HEIGHT 아트 요청 독립 검토

**PASS — 저장소 아트 요청의 근거 검토. 후보 수락·외부 발송·교체·HEIGHT 완료 증거는 아니다.** 현재 main `a392694c3056b93812a0bcc3de767a387f2f3f3b`에서 read-only 검증했다. 최초 관찰 기준 `ab67dcb8`를 보존하며 [요청서](render-human-scale-art-request.md)와 [동반 목록](render-human-scale-art-request.json)에 이번 재검증 HEAD와 범위를 함께 기록했다. 다른 파일이나 원본을 수정하지 않았다.

## 직접 재검증한 범위

- JSON23 entries = historical2 + Wave20 8 + Wave2 5 + Wave26 8, L0 11/L1 12. 각 source/public46 SHA256과 실제 canvas 크기, sourceEqualsPublic23개 모두 현재 파일과 일치한다.
- 공유 Wave20 boarded/snow4개 SHA 및 canvas도 일치한다.
- native 높이/수평폭 구간×worldPxPerNativePx 계산23개 모두 일치한다. 수치 범위를 신뢰구간이나 자동 추출값으로 재해석하지 않았다.
- 기존/Wave2/Wave26 15개는 현재 historical manifest의 기준 alpha crop, native sampling 비율, world 배율 및 동등 native 접지점을 재계산해 일치했다. Wave26 자체 crop8개도 generated manifest와 정확히 대조했다.
- Wave20 8개 `catalogGeometry`는 현재 catalog entry의 pivot/scale/crop/footprint/allowMirror와 정확히 같다.

Graft 노드와 `graft ask ... --source --in src/render`로 경로를 확인한 뒤 실제 소스를 읽었다. Graft는 역사 설명 대신 현재 코드의 증거를 대체하지 않았다. 해당 호출의 절감 추정은14,508 tokens였다. 원본 PNG23개를 이번 검토에서 다시 시각 열람하지 않았으므로 문 경계 추정의 독립 재측정이나 author 관찰23회를 새로 수행했다고 주장하지 않는다.

## a392 현재 계산식

`iso.ts:1–2`의 TILE_W64/TILE_H32와 `historicalHouseAssets.ts:77–82`에 따라 기준 폭은64×.88=56.32, 높이는56.32×alphaHeight/alphaWidth, 접지는 tile center+(0,16)이다. `runtimeAssetCoordinates.ts:8–36`은 authored 좌표를 유지하고 sampling만 derivative/native 비율로 변환한다. 따라서 native 문 높이×56.32/(authored alpha폭×native폭/1254)가 맞으며 해상도 보정을 두 번 하지 않는다.

`wave26HouseArt.ts:73–85`는 기준 rect/bounds의 같은 kx/ky로 crop 범위만 늘린다. Wave26의 실제153²/139² source를1254²라고 잘못 부르지 않는 요청서 설명이 정확하다. Wave20은 `artAdapters.ts:33–38,70–72`의 native crop/scale와 pivot blit을 사용하며 `contractHouseArt.ts:65–80`의 접지는 동일한 tile center+(0,16)이다. 현재 선택은 contract ready body 우선이고 실패/준비 전에는 `historicalHouseAssets.ts:98–105,118–122`의 legacy 경로로 내려간다. 그 안의 준비된 Wave26→Wave2/기존 우선순위 설명도 맞다. readiness와 자산 적격성을 실제 세이브 draw 증거로 바꾸지 않았다.

비교한 historicalHouseAssets/wave26HouseArt/runtimeAssetCoordinates/buildingVariantAssets/walkerComposer/drawWalkers/alehouseCrowd 소스는 ab67→현재 HEAD의 tracked diff가 없다. catalog는 역사 동일성에 의존하지 않고 현재8 geometry를 직접 대조했다.

## 목표·오차·아트 요청의 타당성

`docs/decisions/README.md:566` FND-3은17.6 world px를 정본으로 지정한다. `art-bible.md:22–23`의1.15–1.40H 및.45–.65H를 곱한 목표20.24–24.64/7.92–11.44는 정확하다. 요청서는 내측 개구부 추정, 같은 x에서의 세로 높이, ±2/±3 native px, Wave20 grade별 보수적 구간을 명시한다. 닫힌 문 뒤 유효 개구부의 정확한 제작 좌표로 과장하지 않는 점이 적절하다.

높이 상한 최대 약12.96은 목표 하한20.24보다 충분히 작아 이 오차 범위 안에서는 부족 결론이 뒤집히지 않는다. 폭은 수평 투영 폭이라는 표기가 중요하다. 벽면상의 폭과 직접 같은 값으로 취급하지 않고, 납품 시 실제 모서리와 투영 관례를 확인하도록 한 조건을 유지해야 한다. 이상적인0.894427 변환은 실제 모든 문의 기울기를 측정했다는 뜻이 아니다.

건물 전체 확대를 피하고23개 정체성·필지·scale·pivot을 보존하며 문/벽/처마의 국소 재구성을 제안하는 것은 합리적이다. 지금 수치만으로 각 지붕 아래에 목표 문이 반드시 들어간다고 보장하지 않고, 불가능할 때 수정 영역/실루엣/레이어 매핑을 별도 제안하도록 한다. shared boarded/snow의 네 대상 전체와 Wave26 상태 레이어를 재검토해야 한다는 조건도 필요하다. 이번 본체 조사로 레이어 적합성까지 PASS라고 말하지 않는다.

## 독립적으로 진행 가능한 렌더 작업

현재 `walkerComposer.ts:36–37,230`은 VILLAGER_WORLD_SCALE=.5, WALKER_FIGURE_PX16, factor=32×scale/figureHeight다. `drawWalkers.ts:43–45`는 zoom<.65에서 .65/max(zoom,.01)을 추가한다. 따라서 현재 줌1 등록 높이는16이고 줌.6 화면 높이는10.4다. 정본17.6이 이미 구현됐다는 art-bible의 옛 ‘현재 코드’ 문구를 요청서가 그대로 완료 근거로 쓰지 않는 것은 맞다.

`storyWorldProps.ts:29`도 WALKER_FIGURE_PX/FIGURE_HEIGHT를 사용하며 `alehouseCrowd.ts:147–151` 등 연출 무리가 이를 소비한다. 그러므로 문 아트가 아직 부족하더라도 렌더러17.6 연결, 연출 무리 경로/개별 FIGURE_HEIGHT의 근거 확인, 저줌 바닥 보정·pivot·가림·캐시 영향의 독립 준비/회귀 검증은 진행할 수 있다. 다만 등록 figureHeight는 모자/신발을 포함할 수 있으므로 .55로 바꾸는 것만으로 barefoot 정수리–발바닥17.6 실측 완료가 되지 않는다.

안전한 후속은 기록된 a392 재검증 범위를 유지하고,23개 후보에 모서리·정본 인물의 측정 기준점·오차·레이어 호환 증거를 요청하는 것이다. 병행 renderer 작업은 자체 freeze/tests/actual views로 검증하고 아트 요청 대기로 모든 HEIGHT 작업을 막지 않는다. 아트 제작·외부 전송·runtime 교체는 이번 검토에서 하지 않았다. 두 갈래 모두 실제 world 검수까지 끝나기 전 HEIGHT 완료는 유지해서 미완료로 표기한다.
