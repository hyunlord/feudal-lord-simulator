# 직업 월드 그림 규격 조사

읽기 전용 조사. 게임 코드·설치·커밋 없음. 정확한 원본 경로/해시/기존 발 기준점 전부는 `asset-specs.json` 참조.

## 직업 표지 범위
Wave37의 실제 12종은 제빵·대장·직조·염색·무두·양조·방앗간·목수·상인·목동·어부·여관이다. **무두와 여관은 이미 있으므로 누락 직업이 아니다.** LM20과 비교해 빠진 10종은 푸줏간·재단·구두장이·운송·축융·통장이·수레장이·잡화·향료·포도주. 각각 a/b, **20장**이 정확한 확장 범위다. canonical trade ID는 엔진 정의로 최종 맞춘다.

Wave37 표지는 96×96 또는128×96 RGBA. anchor는 그림별 실제 지지부 접점이며 대개 y=89~90이지만 일괄 중앙하단으로 대체하면 안 된다. 재작업 miller a/b y=78/79. `assets-inbox/wave37/rework-v2/records/assets.csv`가 최신 목록이다. 원본은 candidates-20260930/assets에 있고 재작업4개만 rework-v2/assets가 덮는다. 아직 런타임 배율 계약은 없으며 원래 증명판0.45배는 시험값이다.

## 마당
Wave27 직업 마당: 256×128 RGBA, anchor(128,104),2×1칸. 원래 CSV 표시배율0.5이지만 설치된 `src/render/drawBackyardDecals.ts:25`는0.4이며 지면중심(128,68) 기준이다. 현재 LOD0.8 미만에서 기존 마당을 숨긴다. 따라서 이번0.6 그림 검증은 실제 설치 표시 검증과 다르며 합성임을 명시한다. 새 키 큰 구조물을 기존 ground-pass decal처럼 자동 설치할 수 없다. 후보만 제작한다.

## 워커 짐: 기존 계약 그대로
`public/assets/walker-props-v1/held_*`는 **32×32 RGBA 독립방향 4장(NE SE SW NW)**. 몸체 시트는296×148,74×74셀,4열×2보행행. 짐은 방향당1장이고 같은 그림을 두 보행 프레임의 움직이는 손 기준점에 붙인다. 즉10종이면40PNG이며80장몸체시트가 아니다.

표준짐은0.65배로 셀에 얹는다. `(17+handX-gripX*.65,17+handY-gripY*.65)`에32×.65로 그린다. 손은SE/SW에서frame.hands.left,NE/NW에서frame.hands.right. SW/NW는 몸체 뒤,NE/SE는 몸체 앞이다. foot_x/y를 grip처럼 오기하지 말고 grip_x/y와기준역할을CSV에별도기록한다. 모든 방향 좌상광 유지, 좌우 뒤집기 금지. Wave7의 work_breadbasket은 별도 walkerPoint 및 배율1 계약이므로 표준held짐과 섞지 않는다.

## 크기와 광원
art-bible은H비교기준을 제공한다: 통0.45~0.65H,자루0.30~0.50H,수레바퀴0.45~0.70H. 다만 문서의17.6worldpx는 낡았고 현재walkerComposer.ts:36 성인16worldpx이다. 현재캡처와 합성할때16px성인을 대조하되 H비율표를 유지한다. 그림을 키워 판독률을 얻지 않는다. 정사영2:1,지면축±26.565°,수직유지,왼쪽위광원,약한접촉AO만. 겨울에도 개체의 지지점/캔버스/크기 유지.

## 직접 본 참조
- `public/assets/wave27/yards/yard_tanner_a.png`: 직립 독립가죽틀2개,통·접은가죽. 부서진 작은 흙만 있고 사각밑판 없음.
- `public/assets/walker-props-v1/held_bundle_cloth_NE-v1.png`: 작은 실제32px짐,끈고리집기.
- `assets-inbox/wave37/candidates-20260930/proofs/02-blind-trades.jpg`: 벽에서 떨어진 표지. 여관은 독립 그림간판, 무두는가죽틀이기존존재.

원본이미지는 root도직접열어화풍참조로사용. 본문 경로는 조사저장소내원본 출처이며 납품ZIP내부링크가아니다.
