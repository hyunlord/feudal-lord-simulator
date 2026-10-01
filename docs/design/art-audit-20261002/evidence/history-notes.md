# 고증·통일 규칙 근거 메모

검토일: 2026-10-02. 새 그림 생성·게임 코드 변경 없음. 이 메모는 전체 그림의 육안 검사 결과가 아니라, ART_AUDIT의 시대 축과 ART_BIBLE_v2를 위한 판정 기준이다. 확실성: 아래 직접 소장품·유적 사례는 높음, 사례의 전국 일반화는 금지.

## 적용 원본과 충돌 처리

- 설치 저장소: `/Users/rexxa/github/fls-landui/AGENTS.md` 헌장 1·5절. 지역·연대는 잉글랜드 시장도시 1300–1450이며 주택 굴뚝, 홉 맥주, 육각 관, 문 표식, 담비, 원색 염료 등은 **프로젝트 금지 목록**이다.
- 기존 AB 원본: `/Users/rexxa/github/feudal-lord-simulator/docs/art-direction/AB_2026-09-19_v1.md`, 24–47행. 설치 저장소에서 AB 파일을 찾지 못해 위 원본을 직접 읽었다. 남부·남동부 시장도시 기본값, L3 1375–1450·L4 1400–1450, 기본형/후기 예외 분리. 새 v2 문서에 역사적 가능성을 적어도 설치·예외 자동 승인은 아니다.
- 파이프라인 사본: `/Users/rexxa/github/fls-landui/assets-inbox/wave22/candidates-20260927/records/ASSET_PIPELINE_SPEC_v1.md`. 설치 저장소 `docs/ASSET_PIPELINE_SPEC_v1.md`는 발견되지 않았다. 사본은 2026-09-25 규격이며 fill/strip/decal/module/object, 논리 64×32·제작 128×64, 좌상단 연광·contact AO, 미세 잡음 금지, 원본에서 단일 축소를 규정한다. 이번 의뢰의 줌 0.5/1.0/1.4가 사본의 0.6/1.0/1.35보다 우선한다.
- 연구: `/Users/rexxa/github/fls-landui/docs/research/2026-09-24-content-catalog.md`의 에일·가내노동·지역별 생산 구분, `/Users/rexxa/github/fls-landui/docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md`의 사료 연대 구분을 읽었다. 연구 파일의 내부 `turn...` 표기는 외부 인용 URL이 아니므로 새 바이블에서 그대로 재사용하지 않는다.

## 시대 판정표: 역사와 프로젝트 규약을 분리

| 항목 | 확인한 역사 | 이 프로젝트의 기본 / 예외 처리 |
|---|---|---|
| 굴뚝·난로 | Kent의 Old Soar Manor 약 1290년 solar에는 벽난로·chimneybreast가 있고 중앙 홀은 개방 화덕이다. 따라서 1300년에 굴뚝이 존재하지 않았다는 주장은 틀리다.[H1] | L0–L2 및 L3/L4 기본 주택의 외부 굴뚝은 금지. 위반은 `프로젝트 규약`으로 표기. L3/L4 후기 변형의 수수한 석조 굴뚝 1개는 기존 AB의 **검토 후보**일 뿐이며 승인 기록 없으면 허용하지 않는다. 영주관·기능성 화덕은 역할·실제 승인 규격을 먼저 확인한다. |
| 창 | 같은 1290년 장원의 solar와 예배당에 유리창 사례가 있다.[H1] | 일반 주택은 작고 어두운 무유리 개구부·덧창. 청록 반사·대형 유리·새시창은 금지. 작은 회녹 납틀창 1–2개는 후기 L3/L4 승인 변형만. 교회/장원 유리를 일반 주택 금지로 오판하지 않는다. |
| 옷 색·염료 | London Museum의 후기 14세기 실크 조각은 꼭두서니(madder)로 분홍 염색되었다. 중세 천이 모두 회갈색이었다는 근거는 없다.[H2] | 옷의 저채도화는 화풍 통일. 큰 면적의 순 RGB 원색·형광색은 보정 대상이지만, 빨강/파랑/노랑이 있다는 이유만으로 시대 오류로 쓰지 않는다. 유물은 변색될 수 있어 사진 색을 HEX 정답으로 취하지 않는다. 피부색·체형은 계급·도덕성과 연결하지 않는다. |
| 문장 | 전통 문장에는 빨강·파랑·초록·검정·보라, 금/노랑·은/흰색이 쓰인다. 색과 금속의 대비가 식별 규칙이다.[H3] | 문장은 옷의 무조건 탈채도 규칙과 분리해 구별 가능한 색면을 유지하되 네온·3D 크롬은 금지한다. 실제 문장을 임의 조합하지 않고 승인된 가문·문양 ID를 보존한다. |
| 에일·홉 | Herefordshire 지방정부 자료는 전통 English ale에 홉을 넣지 않았으며 홉 양조 도입을 15세기로 설명한다.[H4] | 1300 기본 장면은 무홉 에일. 캠페인 후반 역사적 가능성을 이유로 홉 금지를 해제하지 않는다. 홉 덩굴·홉 원료 표시는 `프로젝트 금지`로 기록; 단순 통·컵만 보고 홉 맥주라고 단정하지 않는다. |
| 기둥풍차·수차 | MOLA의 직접 발굴 사례는 13세기 중세 풍차와 몸체를 바람에 돌리는 중앙 기둥을 설명한다.[H5] Historic England의 Mills는 중세 수차도 다룬다.[H6] | 곡물 mill 그림은 목조 buck·중앙기둥·십자받침·4날개·꼬리대의 post mill. 곡물 수차 금지는 프로젝트 선택이며 중세 수차의 부재를 뜻하지 않는다. 수력 축융 시설은 기능이 달라 곡물 mill 금지와 혼동하지 않는다. 탑풍차·스목풍차로 임의 승급하지 않는다. |
| 관·매장 | Historic Royal Palaces 발굴 발표에는 후기 12세기/초기 13세기 관 매장과 수의 조각이 있다. 관 자체는 중세에 없던 물건이 아니다.[H7] | 육각형 현대 관 실루엣은 프로젝트 금지로 적는다. 단순 나무 상자/수의는 승인 그림을 기준으로 한다. 이 조사 자료는 특정 육각 관 형태의 최초 연대를 입증하지 않으므로 '육각 관은 무조건 몇 세기 발명'을 쓰지 않는다. |
| 지붕·재료 | 기존 AB의 지역·양식 계약을 적용한다. 재료 색과 지역 통일은 고고학적 존재/부재의 명제가 아니다. | 초가·채도 낮은 테라코타 평기와·따뜻한 석회·갈색 참나무·회갈 잡석. 기본 주택의 슬레이트, 검정 들보/새하얀 판, 벽돌벽, 팬타일·S기와, 근세 능보는 금지. 석재 건물·교회 자체는 일반 주택 금지와 구별한다. |

## ART_BIBLE_v2에 넣을 효력 문안

`historical_profile: S_England_1300_1450_v1`. 1300을 기본 장면으로 사용하되 1300–1450 전체를 동일 시점으로 취급하지 않는다. 발전은 목재→벽돌→석재 기술 사다리가 아니라 같은 시대에 공존하는 밀도·상업 전면·정돈 차이로 표현한다. 후기 예외는 `assetId / 파일 SHA / 역할 / 연대 범위 / 지역 / 예외 내용 / 역사 출처 / 승인 근거`가 함께 있는 것만 인정한다. 예외의 역사적 가능성은 제작·설치 승인과 별개다. 승인 없는 변경은 후보로만 남긴다.

외부 박물관 사진·삽화는 사실 확인에만 쓴다. 앞으로 생성할 때의 시각 참조는 프로젝트 자체 승인 원본만 사용하며 candidate를 자동 기준으로 승격하지 않는다. 구도를 바꾸지 않는 오버레이는 동일 캔버스·피벗·접지·실루엣을 유지한다. 감사 패키지 자체는 설치 승인·원본 수정 권한이 아니다.

## 감사에서 피해야 할 단정

1. 사진에 보이는 유리·굴뚝을 연대/용도 확인 없이 전부 '1300 오류'로 분류하지 않는다.
2. 사건 삽화의 실내 촛불·난로 보조광은 외부 월드 스프라이트 좌상단 광원과 별도 판정한다. 얼굴·오브젝트의 주광 통일과 이야기 속 광원을 구별한다.
3. 같은 재료라도 젖음·그늘·노후·실내색은 색차 원인이다. 기본 재료 중간톤과 조명 상태를 분리한 뒤 비교한다.
4. 그림에서 읽히지 않는 작은 문양·물체는 `미판정`으로 남긴다. 기록 없는 예외를 '승인됨'으로 추정하지 않는다.
5. 후기 사건 삽화를 1300 복식만으로 다시 그리도록 요구하지 않는다. 1450 이후 비교자료가 혼입된 경우만 해당 형상을 확인하고 표기한다.

## 기관·직접 조사 출처 (7개, 2026-10-02 확인)

- [H1 — English Heritage, History of Old Soar Manor](https://www.english-heritage.org.uk/visit/places/old-soar-manor/history/): 약1290년 Kent 유적, solar의 chimneybreast와 유리창, 중앙 홀 화덕.
- [H2 — London Museum, Fragment BC72[83]<1907/2b>](https://www.londonmuseum.org.uk/collections/v/object-731999/fragment/): 후기14세기 madder pink silk 소장품.
- [H3 — English Heritage, A beginner’s guide to heraldry](https://www.english-heritage.org.uk/guide-to-heraldry): tincture·금속색·대비.
- [H4 — Herefordshire Council, Medieval villages: Food](https://htt.herefordshire.gov.uk/herefordshires-past/the-medieval-period/villages/food/): 무홉 에일과 15세기 홉 양조 도입 설명.
- [H5 — MOLA, A one-in-a-mill-ion find](https://www.mola.org.uk/discoveries/news/one-mill-ion-find-uncovering-medieval-mill-a428): 중세 post mill 직접 발굴.
- [H6 — Historic England, Mills](https://historicengland.org.uk/images-books/publications/iha-mills/heag212-mills/): 중세 수차·풍차 유형 개요. 최초 PDF 응답을 확인했으며 후속 일부 범위 조회는 시간초과; 구체적인 최초 연도 주장은 사용하지 않음.
- [H7 — Historic Royal Palaces, Tower of London medieval excavation](https://www.hrp.org.uk/media-and-press/press-releases-2025/most-significant-archaeological-dig-at-the-tower-of-london-in-a-generation-reveals-new-insights-into-the-tower-s-medieval-past/): 후기12/초기13세기 관과 수의; 14세기 매장군과 구별해 읽음.
