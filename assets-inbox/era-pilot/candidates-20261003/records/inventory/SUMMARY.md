# 시대 정합성 파일럿 소스 인벤토리 — 2026-10-03

읽기 전용 조사. 기준 clone `/Users/rexxa/fls-astra-era`. 코드/이미지 수정 및 commit 없음. graft 로컬 캐시만 생성. 실제 PNG를 Pillow로 열어 치수·모드 확인하고 SHA256 기록. `source_inventory.csv`는 926행이며 게임 전체 이미지 총수가 아니라 아래 조사 범위의 정확한 소스 목록이다.

## 제작용 참조

- 워커 4개: `public/assets/walkers-v2/wk_labor_m_01-v1.png`, `wk_labor_f_01-v1.png`, `wk_merchant_m_01-v1.png`, `wk_gentry_f_01-v1.png`. 전부 296×148 RGBA. 74×74 셀, 4열 NE/SE/SW/NW, 2행 gait0/gait1. 프레임 8개/시트. 재도색 대상은 신체·얼굴·손발·접지·포즈 보존. `walker_selected_manifest.json` 및 `walker_frames.csv`에 프레임별 원본 foot/figureHeight/hand socket을 그대로 추출했다. 피벗을 (37,74)로 일괄 대체하면 안 된다.
- 초상 6명: `assets-inbox/portrait-pool/pool1-20260926/assets/portraits/{ID}_mature.png`, 모두 256×256. I037 남 젠트리 steward; I040 여 젠트리 household manager; I043 남 wool merchant; I046 여 cloth trader; I049 남 blacksmith; I060 남 secular parish priest. 남녀 짝은 파일럿 구성이고 실제 부부 관계가 설정된 것은 아니다. 기록상 raw 경로는 존재하지만 이 clone에 해당 raw PNG는 없다. 존재하는 received source PNG가 위 경로다. 기존 얼굴·연령·방향은 유지하며 복식만 조정할 참조. 실제96px 구분 검수가 별도로 필요.
- 집 L2/L3/L4 기준: `public/assets/buildings/historical-houses/house_l2-v2.png` 137×137, `house_l3-v2.png` 142×142, `house_l4-v2.png` 161×161. Wave26은 같은 등급 캔버스를 유지한다. L2 원본을 L3/L4로 무단 확장하지 않는다.
- 간판 4종: `assets-inbox/experiments/wave36-building-kit-pilot-20260930/assets/sign_{bread,ale,smith,textile}.png`; 각137×137. `sign_merchant.png`도 있으나 예비. **Wave36 실험 후보**이므로 승인된 스타일로 승격하지 않는다. `records/anchors.csv`에는 원본 body별 부착 지점과 low confidence ±2px가 기록되어 있다. 빵 부착 목표(43,104), 대장간(98,97) 등은 해당 body에만 유효하다.
- 교회 기준: `public/assets/buildings/historical-facilities-v1/church-v2.png` 233×233. 옛 `public/assets/buildings/church.png`는176×208로 별도 소스다.

## 전체 제작 범위 산정 기준

### 워커

`public/assets/walkers-v2` 44시트=352프레임. 역할별 노동8, 장인4, 직물3, 상인4, 젠트리2, 하인6, 사제1, 수도사1, 수녀1, 빈민4, 방문객2, 아이4, 노인4. 현재 `walkerSheetManifest` 전체는60시트: 44 외에도 legacy와 추가 물류 역할 등이 들어 있어 60전체를 V2수량으로 부르면 안 된다. 추가16의 범위는 CSV에 별도 URL/legacy/classBand로 식별 가능.

### 초상

`src/ui/portraitArtManifest.generated.ts`에서 실제 참조 630개 소스: Pool304 + 가계326. 256/96 JPEG 파생본은630의 두배인1260 납품물일 수 있지만 identity나 원본 그림 수에 중복 산입하지 않는다.

Pool304: 초기 파일럿48(기본36+4명×3나이), Pool1 92, Pool2 92, Pool3 72. Pool1/2 각각32identity(성인28×3 + 아동4×2), Pool3 24identity×3. 전체 Pool 식별자124명, 파일 단계 pool36/young92/mature84/old84/child8. Pool3의72개는 승인본 보존 대상이며 일괄 재작업 대상이 아니다. 단계별 class·직업·성별은 `docs/design/portraits/portrait_{pilot,pool1,pool2,pool3}.csv`에 있다.

가계326: L1 34, L2 34, L3 38, L4 38, L5 38, L6 30, L7 32, L8 38, 공통C40, L0 4. 단계는 baby78/toddler15/child79/young87/mature55/old12. L1–L8 282이미지/92identity + L0 4identity + C40 독립공통이미지 =136개의 식별자 그룹. C시리즈는 이름만 보고 같은 번호의 나이를 한 사람으로 묶지 않는다. 교체 전 파일과 proof가 ledger에 존재하므로 production plan은 위 active manifest를 기준으로 한다. 모든326개를 새로 생성하라는 권한은 아니다.

### 주택·상업·교회

- historical-houses 원본11: 단독L0–4=5 + L2–4합필2방향=6.
- Wave26 단독100: L0–4×변형c/d/e/f×상태(base/fresh/weathered/boarded/snow). 등급별20개. L0 153²/L1 139²/L2 137²/L3 142²/L4 161².
- Wave30 합필90: L2–4×가로/세로×변형c/d/e×5상태. 등급별30개. L2가로195×156/세로183²; L3가로209×167/세로183²; L4가로204²/세로184².
- Wave2 주택18: L0 2,L1 3,L2 3,L3 3,L4 3,합필4. 상업/작업장 특징을 명시한 최소7개는 house_l1_artisan,house_l2_brewer,house_l2_weaver,house_l3_clothier,house_l3_shop,house_l4_inn,house_pair_l3_vertical_workshop. 집 변형18에 포함되는 부분집합이므로 별도 더하면 중복.
- Wave2 전체 건물28에는 chapel_b,chapel_stone 2개 및 market3/storehouse2/well2/windmill1 포함. 교회 소스2개와 chapel2개는 서로 다른 소스/범위다. 오래된 church.png를 자동 폐기하지 않는다.
- 상업 sign은 Wave36 실험5종(파일럿4종 + merchant예비). 샵 건물·시장·간판은 서로 다른 제작 단위다.

## 스타일 및 검수 계약

`docs/design/art-bible.md` ART_BIBLE_v2 / S_England_1300_1450_v1 우선. 남부·남동부 잉글랜드1300 기본형/후기 변형 명시. 월드 부드러운 회화 프리렌더 등각2:1/좌상광/검은 외곽선 금지; 초상 자연스러운 회화형 얼굴·부드러운 좌상광·회갈색 배경. 피부색/체형과 계급·도덕성 연계 금지. 일반 굴뚝/유리 금지와 후기L3/L4 예외를 구분. 96px 초상, 프레임별 접지, 실게임0.5/1/1.4 검증은 이번 inventory 작업에서 수행하지 않았다.

Graft source 조회 절감 표시 합계 약115,120tokens(도구 추정); 실측 토큰 사용량이 아니다.
