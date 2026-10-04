# 창고 화면 배경의 영주관 기본도형 — 제한 조사

**소스·기하 정합에 의한 높은 확신의 귀속: manor-house-34-41-0, manor_house, 타일(34,41).** 실제 렌더 분기를 trace한 결과는 아니다. 해당 배경 건물을 직접 클릭한 QA 선택ID도 없다. 기존 미설치 Wave12 영주관 그림이 실제 화면에서 기본도형으로 드러난 사례로 분류하며, 새 렌더 버그·AS03의 재현으로 세지 않는다.

## 화면과 저장을 맞춘 근거

세 원본 이미지는 앞선 저장고 독립 검수에서 직접 열어 보았다. 이번 소스 조사에서 저장의2×2 영주관 좌표, 각 클릭 직후 기록된 카메라, drawBuildings.ts:244–248의 중심 계산과 buildingFallbackShapes.ts:33–49/101–108의 몸체·shed 지붕 계산을 대조했다. 계산 원본 check.rb와 결과 REVIEW.json을 보존했다. 엔진·렌더 함수는 실행하지 않았다.

|이미지|카메라 zoom/pan|중심|몸체 앞면 범위|해석|
|---|---|---|---|---|
|[0015](../storage-ui-executed-r07/storage-1350/0015-storehouse-41-40-0-top.jpg)|2 /576,-2192|(128,240)|x56–200,y128–240|왼쪽 크림색 무질감 몸체와 일치|
|[0025](../storage-ui-executed-r07/storage-1350/0025-construction-site-000039-top.jpg)|2 /896,-2352|(448,80)|x376–520,y-32–80|같은 도형이 화면 위로 일부 잘림|
|[0035](../storage-ui-executed-r07/storage-1350/0035-construction-site-000050-top.jpg)|2 /640,-2352|(192,80)|x120–264,y-32–80|HUD 아래 남은 몸체와 일치|

첫 지붕 꼭짓점은(46,132),(212,80),(216,136),(50,152)이다. 둘째는(+320,-160), 셋째는(+64,-160)만큼 옮겨진 동일 윤곽이다. 저장 후보 검색에서도 해당 화면 좌상단 투영 범위에 manor_house가 대응한다. 이미지의 작은 선을 픽셀 단위 분할한 실측치는 아니며, 정확한 기하값과 육안 윤곽의 일치다.

## 소스 분기와 이미 알고 있던 설치 공백

buildingCatalog.ts:139–142는 manor_house 그림이 inbox에 있으며 렌더 설치 예정이라고 명시한다. entry에는 body width72/height56/roof24, parchment/earthDark/shed만 있고 facilityArt와 spriteKey는 없다. historicalFacilityAssetId는 facilityArt가 없으면null, drawHistoricalFacility는false를 반환한다. buildingSpriteKeyOf는 종류명 manor_house로 돌아가며 현행 runtimeWorldAssetManifest에는 해당 키가 없다. drawWorldSprite는 메타가 없으면false. drawBuildings.ts:186–202는 이 경우 drawBody/drawRoof 기본도형을 그린다. 소스10파일은 실제 UI 실행의1095개 소스핀과 일치했다. 따라서 일시적 다운로드 실패를 원인으로 추측할 필요가 없는 정적 미연결 경로가 존재한다. 실제 런타임 분기 trace나 네트워크 감사는 하지 않았다.

R06 install-plan-updated/INVENTORY.csv의 Wave12 manor_house_a-v1/b-v1 행은 이미 **install_new/pending_existing_plan**으로 남아 있고 native pivot을 연결해야 한다고 설명한다. 두 행 전문을 PLAN_ROWS.json에 고정했다. 원본 A 그림(416×328)을 직접 열어 질감 있는 석재·목조 홀임을 확인했으며 현재 크림색 기본도형과 다른 미설치 원화라는 것만 확인했다. A/B 선택·활동·빈집 상태 연결을 설치하지 않았다.

R01~R05 ASSET_STRATEGY의 AS03은 TradeHousehold.tradeId/workshop과 옛 craft/occupation 기반 마당 그림 선택의 불일치 위험이다. R06도 이 직업 연결 위험을 승계한다. **영주관 기본도형과 같은 서명이 아니다.** AS01은 인물 배율, AS02는 구 설치계획, AS04는 승인 랜드마크44의 성장 조건 연결이므로 이번에 이들을 새로 재현했다고 쓰지 않는다. 현재 발견은 기존 Wave12 영주관 설치 대기 계획의 제한적 시각 증거 보강이다.

## 권고와 한계

신규 중간 이상 독립 결함0건을 권고한다. 미설치 상태의 중요도가 없다는 뜻이 아니라 이미 기록된 설치 공백을 새 렌더 회귀로 중복 집계하지 않는다는 뜻이다. 승인44장 재작업이나 새 원화 제작은 필요하지 않다. 후속 설치안에서 기존 Wave12 영주관의 pivot·발판·실제 가문 상태 연결 우선순위를 높이고, 동일 카메라에서 기본도형이 기존 원화로 대체되는지 확인하는 정도가 적절하다. 설치 승인은 별도이며 이번에는 어떤 그림·코드도 설치하거나 수정하지 않았다.

이번 조사로 영주관 선택상세, 빈집/점유 조건, 겨울 그림,4방향 가림, 전체 에셋 누락 여부는 검증하지 않았다. 원본 그림·소스·실행증거·설치장부의 SHA는 REVIEW.json에 있으며 산출물만 별도 폴더에 기록했다.
