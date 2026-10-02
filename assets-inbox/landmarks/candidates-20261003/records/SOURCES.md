# 랜드마크 성장 출처·검증 경계

확인일2026-10-03. 저장소 `/Users/rexxa/fls-astra-landmarks`, 확인 HEAD `c2460918ecb13cdd6475f25f3e4809b3a352b01d`. HEAD는 문서 작성 중 `git rev-parse HEAD`로 재확인했다. 제작 상태는 candidate이며 이 출처 목록은44PNG의 완료·통과 증거가 아니다.

## 내부 기준과 현재 엔진

| 경로(위 HEAD 기준) | 사용한 내용 | 검증 한계 |
|---|---|---|
| `docs/design/art-bible.md` |2026-10-02 채택 ART_BIBLE_v2, 남부/남동부1300–1450,동시대 재료 공존,등각·광원·색·예외 |기존 모든 그림의 적합성을 자동 승인하지 않음 |
| `docs/design/lord-mode.md` |권리·약속·사람·돈으로 조건을 만들고 도시가 반응하는 영주 모드 |연도 도달만으로 모든 건물을 자동 증축하지 않음 |
| `assets-inbox/era-pilot/candidates-20261003/records/ERA_GUIDE.md`, `records/proofs/VERDICT.md` 및 `PROTOCOL.md`(동일 후보 폴더 기준) |작은 집·인물 변화의66.7% 판별 결과와 큰 건물 증축 방향 |이번 표본과 직접 통계 비교할 수 없음; 실제 엔진 캡처 아님 |
| `docs/research/2026-09-24-content-catalog.md` |교회·시장·여관·길드홀·교량·장원 카탈로그,선택적 성벽·희귀 bridge chapel |내부 옛 citation 토큰은 외부 검증 링크로 재사용하지 않음 |
| `docs/research/2026-10-02-market-town-trades-gpt.md` |500–2,000명 시장도시의 입지별 상업·직업 다양성 |모든 직업이 한 도시에 동시에 존재한다는 뜻 아님 |
| `docs/research/2026-09-30-gentry-estates-1300-1450-gpt.md` |재산/권리 묶음·가문 투자·시기 밖 비교자료 분리 |확률·가격을 역사 통계로 옮기지 않음 |
| `src/content/buildingConfig.ts`, `src/content/buildingCatalog.ts` |chapel/church/market/manor_house kind·점유·등록 |새 성장 단계의 구현 증거 아님 |
| `src/engine/legacy.ts`, `src/content/legacyConfig.ts` |교회 증축청원과 naveRebuilt·가문 상태 |그림 선택과 연결되지 않은 상태 구별 |
| `src/content/chapterConfig.ts`, `src/engine/reorganisation.ts` |시장권·자치권·길드 설립 |권리 이전≠석교 또는 건물 증축 |
| `src/render/historicalFacilityAssets.ts`, `src/render/historicalFacilityManifest.ts` |시설 고정 선택·quiet/active·crop/표시폭 |실측 브라우저 화면이 아닌 코드/메타데이터 |
| `src/engine/era.ts`, `src/engine/constructionLifecycle.ts`, `src/render/gateArtRenderer.ts` |성벽 재료 공사 완료·문 portal 정합 |문루3tier 없음 |
| `src/world/bridges.ts`, `src/render/drawBridges.ts` |span·목교 tile deck·전후 rail |석교/예배당 tier 없음 |
| `src/state/openingVillage.ts`, `src/render/buildingVisualState.ts`, `src/render/buildingFallbackShapes.ts` |영주관 배치·공석·절차형 렌더 |keep와 별개,공석과 departed 별개 |
| `src/render/reorgWorldProps.ts`, `src/render/wave12GuildhallManifest.generated.ts` |길드홀 표시용 prop·3×2 자리·pivot |건설 가능한 BuildingKind 아님 |
| `src/render/buildingVariantManifest.ts`, `src/render/buildingVariants.ts`, `src/render/houseVariantChoice.ts`, `src/content/houseVariantConfig.ts` |L4 주택 inn 외관과 선택 |독립 여관 경제·성장 명령 없음 |

소스별 행과 현재 등록값은 [records/ENGINE_MAP.md](records/ENGINE_MAP.md)에 있다. Graft 탐색 결과는 로컬 소스 확인을 보조했으며 자체를 게임 동작 증거로 삼지 않는다. 런타임 캡처·충돌·통행·성능·설치 QA는 미실시다.

## 외부 역사 근거

아래는 기관의 본문 또는 공식 검색 결과를 확인한 출처다. S번호는 LANDMARKS의 단계 표와 대응한다. 개별 유물의 현존 외관에는 후대 복원이 섞여 있으며 어느 것도22단계 전체를 입증하지 않는다.

| 번호 | 기관·직접 링크 | 확인된 근거와 적용 제한 |
|---|---|---|
|S1|[English Heritage: Kempley history](https://www.english-heritage.org.uk/visit/places/st-marys-church-kempley/history/)|약1130 작은 Norman 교회,약1276 서탑,14세기 포치. 석조 몸체/탑이1300 이전에도 존재했다는 증거 |
|S2|[Historic England: Yeovil church,1055713](https://historicengland.org.uk/listing/the-list/list-entry/1055713)|1380–1400 Early Perpendicular 재건과1851–60 복원. 후기 창 형태 참고,현재 세부 전체 복제 금지 |
|S3|[HE Poultry Cross1243148](https://historicengland.org.uk/listing/the-list/list-entry/1243148), [Salisbury City Council](https://salisburycitycouncil.gov.uk/our-city/the-poultry-cross/)|HE 목록C14와 시청 후기15세기 설명이 다름. 현존 형상을1450 이전 확정으로 사용하지 않고 단순 시장 십자가 합성 |
|S4|[HE Thaxted1112905](https://historicengland.org.uk/listing/the-list/list-entry/1112905), [HE dendro report17/2021](https://historicengland.org.uk/research/results/reports/17-2021)|구목록1390–1410,열린 하부 market house와 목골 상층.2022 발행 최신 수목연대는 주요 벌목 범위1428–53. 구연대를 확정값으로 인용하지 않음;1450 경계 사례 |
|S5|[Kent HER: Westgate MKE93141](https://heritage.kent.gov.uk/Monument/MKE93141/)|Canterbury 석조문 재건1380. 작은 마을의 보편적 성문 성장사가 아님 |
|S6|[Abingdon Town Council: bridge](https://www.abingdon.gov.uk/abingdon_buildings/abingdon-bridge)|1416 지역 주도 교량,1441 Holy Cross 유지 조직. 공동 투자 근거;후대 보수 및 동일 지점 목교 전신은 별도 검증 필요 |
|S7|[Rochester Bridge Trust: chapel](https://rbt.org.uk/about-us/the-bridge-chapel/)|1393 신규 예배당,석교 동쪽 접근부. B3 접근부 배치 근거,중앙 교각 위 예배당 근거로 쓰지 않음 |
|S8|[English Heritage: Old Soar](https://www.english-heritage.org.uk/visit/places/old-soar-manor/history/)|약1290 석조 solar/예배당·유리·벽난로,연결 홀은 목조. 석조 대홀 직접 근거 아님 |
|S9|[National Trust Collections: Ightham](https://www.nationaltrustcollections.org.uk/place/ightham-mote), [National Trust property](https://www.nationaltrust.org.uk/visit/kent/ightham-mote)|1340년대 핵심부와14세기 해자 장원;후기15·16·17세기 변경 존재. 현존 문루·날개 전체를1340 형태로 쓰지 않음 |
|S10|[Historic England: New Inn1245714](https://historicengland.org.uk/listing/the-list/list-entry/1245714)|약1450 안뜰·회랑 여관. Edward II 순례객 전용이라는 전통은18세기 이전 기록 없음. 후대 정면/새시창 제외 |
|S11|[Historic England: Greensted dating](https://historicengland.org.uk/research/results/reports/14-1996)|오래된 목조 교회 생존 사례. 희소 표본으로1300 교회의 재료 빈도를 산출하지 않음 |

Essex·Gloucestershire·Somerset 사례는 남동부와 함께 쓰는 영국 남부/접경 비교 근거다. 모든 세부를 Kent/Sussex의 동일한 지역 양식이라고 부르지 않는다. 단계별 기간·합성 평면·후원 조건은 근거에서 추론한 게임 설계이며 실존 한 건물의 복원 계보가 아니다.

## 후대 사례 배제

- [Chipping Campden Market Hall,National Trust](https://www.nationaltrust.org.uk/visit/gloucestershire-cotswolds/market-hall):1627.1450 이전 시장홀 증거로 사용 금지.
- [Stokesay gatehouse,Heritage Gateway](https://www.heritagegateway.org.uk/Gateway/Results_Single.aspx?resourceID=1015&uid=MSA16330):현존 목골 문루1640–41.13세기 장원 몸체와 구분.
- [Bradford-on-Avon bridge,Historic England](https://historicengland.org.uk/listing/heritage-gateway/results/record/c243caee-fd96-4d6f-ac56-2b804b37d81b/1445815):현존 Chapel은 probable C17 lock-up 설명. 중세 예배당 원형으로 복사 금지.
- [Guildford 시청 전시자료](https://www.guildford.gov.uk/media/19235/Guildford-Heritage-Exhibition-and-Events-Programme-October-to-March-2017/pdf/Exhibs_Events_Prog_October_2016_web.pdf):현존 Guildhall16/17세기,시계1683. 중세 홀 외관 근거로 사용 금지.

## 생성 이미지 참조와 출처 관리

**이미지 생성의 시각 참조는 프로젝트 소유 자산만 사용한다.** 위 외부 링크는 역사 텍스트 근거이며 외부 사진·그림을 다운로드하거나 모델 참조 이미지로 쓰는 승인이 아니다. 프로젝트 원본과 ID를 보존하고 결과는 별도 candidate로 관리한다.

전체 생성 프롬프트는 `records/prompts/`, 단계별 원출력은 `raw/`에 기록한다. 새 단계는 프로젝트 자산 및 앞 단계의 완성 그림을 참조하며, 외부 역사 사진을 시각 참조로 사용하지 않는다. 실제 참조·원본의 SHA256은 대응 provenance/등록 결과를 확인하며 이 문서에서 임의로 생성하지 않는다.

완성44PNG 파일 목록·기하 CSV·동일 캔버스/기준점·계절 정합·증거 이미지·해시·ZIP 검사는 각각 실제 산출물에 근거해 확인한다. 등록 출력 계약은 `assets/manifest.csv`, 정의는 `records/registration.json`, 도구는 `records/tools/register_assets.py`다. 전 단계2048×2048,피벗(768,1536),world_scale=0.25. footprint는64×32 world 격자의 제안 예약 영역이며 실제 엔진 충돌 검증값이 아니다. 본 문서에 통과 수를 선기입하지 않는다.

### 현재 도시 비교에 쓰는 프로젝트 자산 경로

`records/tools/compose_city.py`의 SOURCES를 확인했다. 아래 경로는 위 HEAD 저장소의 `public/assets/` 기준이고 복사본은 `references/`에 있다. 도시 비교의 배경·주택·사람 참조이며 모든 랜드마크 생성 호출에 아래 전부가 첨부되었다는 뜻은 아니다.

| 프로젝트 원본 | 작업 복사본 |
|---|---|
| `public/assets/terrain/grass.png` | `references/city-grass.png` |
| `public/assets/wave15/terrain/grass_winter_fill-v1.png` | `references/city-winter.png` |
| `public/assets/terrain/packed_earth_road.png` | `references/city-road.png` |
| `public/assets/complete-art-v1/water-bridges/water_surface-v1.png` | `references/city-water.png` |
| `public/assets/wave26/house/house_l1_c.png` | `references/city-house.png` |
| `public/assets/wave26/house/house_l1_c_snow.png` | `references/city-snow.png` |
| `public/assets/walkers-v2/wk_labor_m_01-v1.png` | `references/city-walker.png` |

### 재현성

생성 도구는 `image_gen.imagegen`; 정확한 모델 이름·버전·seed는 도구에 노출되지 않는다. 전체 프롬프트 보존은 감사 근거이며 동일 픽셀을 재생성할 수 있다는 보장은 아니다. 등록은 수동 여름 anchor·균일 배율,겨울 전체 이미지의 균일 배율/평행이동을 합성한 whole-image affine 처리다. 부품 추출·재조립·비균일 늘이기·계절 알파 강제치환으로 정합시키지 않는다. `records/REGISTRATION_METHOD.md`와 실제 등록 결과가 변환 근거이고,알파 실루엣 일치는 내부 창·문·지붕 구조의 동일성 또는 런타임 적합성을 입증하지 않는다.
