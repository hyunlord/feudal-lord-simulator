# RB-HERDS — 기존 목초지 양 무리 그림 1장 설치

제품 커밋은 `001a4873`이다. 기존 목초지의 `sheep_flock` 소품을 Wave 13 양 무리 한 장으로 그린다. 새 동물 actor·경로·보행·가축 수를 만들지 않는다. 파일명의 `moving`은 동작 보증이 아니며, 원 기록의 `staticCluster: true`, `animation: false`를 계약에서도 강제한다.

## 원본과 등록

- 원본: `assets-inbox/wave13/candidates-v1/assets/herd/sheep_cluster_moving_a-v1.png`
- 런타임: `public/assets/wave13/herd/sheep_cluster_moving_a-v1.png`
- 두 파일 SHA256: `f74aa7a61063a809789709b65d436b7a5a49841834145080d5720425de40872a`
- 파일 크기 22,142바이트, RGBA 시트 512×96. 바이트가 동일하다. 실측 PNG 청크는 `IHDR,pHYs,IDAT,IDAT,IDAT,IEND`이며 `caBX`는 0개다. 제거한 청크도 0개다.
- 묶음 `core-wave13-pasture-herds`, 팩 `core`, 종류 `ground-prop`, 배치 `farm-prop`, `baseId: sheep_flock`.
- [registration.json](registration.json)은 실제 `src/render/art/catalog.json`의 해당 묶음을 그대로 복사했다. 그림은 한 장이고 계약 항목은 네 개다.

| 방향 | 소스 crop x,y,w,h | 시트 기준 pivot | 셀 기준 pivot |
|---|---|---|---|
| NE | 0,0,128,96 | 64,63 | 64,63 |
| SE | 128,0,128,96 | 192,63 | 64,63 |
| SW | 256,0,128,96 | 320,63 | 64,63 |
| NW | 384,0,128,96 | 448,63 | 64,63 |

배율은 `src/render/animalScale.ts`의 공통 `WAVE13_ANIMAL_SCALE`, **0.20670180722891565**다. 각 셀의 세계 캔버스 크기는 **26.457831325301203×19.843373493975903px**다. 너비와 높이에 같은 배율을 쓰고 미러링하지 않는다. 시트 pivot은 crop 원점을 빼서 셀 pivot으로 바뀐다. 개별 양의 몸집을 캔버스 전체 크기와 혼동하지 않는다.

## 소비와 불변 조건

`drawBuildings → drawFarmProp → FARM_PROP_ART.draw`가 실제 경로다. `src/render/farmPropArt.ts`는 기존 소품의 ID 해시로 정적인 방향 한 개를 고른다. 시간·계절·이동 방향은 이 선택에 들어가지 않는다. `FARM_PROP_ART.select`, `ready`, `bounds`로 선택, 디코드 완료, 실제 표시 사각형을 확인할 수 있다.

소품 ID·좌표·종류 선정·깊이 큐와 엔진 가축 집계는 바뀌지 않는다. 이번 설치는 `sheep_flock`만 바꾸며 `sheep_flock_b/c/d`, 소·돼지·일하는 소는 기존 그림을 쓴다. **기존 `sheep_flock` 그림에서 보이는 몸통은 6개이고 새 그림의 각 셀은 4개다.** 그림 속 개체 수가 감소한 것이므로, 엔진 집계도 감소했다거나 모든 양의 수를 정확히 표현한다고 주장하지 않는다.

이미지가 로딩 중이거나 누락·디코드 실패·치수 오류이면 기존 그림과 기존 bounds를 함께 쓴다. 준비된 새 그림은 crop 기준 bounds를 쓴다. 봄 동반 양 배치는 이 동일 bounds를 읽어 4 world px 간격과 이웃 충돌 검사를 수행한다. 봄 양이 새로 태어났다는 엔진 사건을 만들지는 않는다.

## 제작 기록과 빠진 정보

[source-record.json](source-record.json)은 `records/metadata-herds.json`의 `herd/sheep_cluster_moving_a-v1` 항목을 그대로 복사한 것이다. 원 기록의 `processing.sourceCells`에는 방향마다 네 멤버의 정수 좌표·발 위치·깊이 순서가 있다. `records/herds-build.cjs`는 `assets/animal_walk/sheep_single-v1.png`의 첫 행 셀들을 사용하며, 새 그림 생성 없이 정적으로 합성한다. 설치 과정에서는 그 합성을 다시 수행하거나 픽셀을 수정하지 않았다.

최초 양 그림의 생성 도구·모델·정확한 생성일·seed는 기록에 없으므로 **unknown**이다. 기록된 것은 프롬프트·rawFile·참조 이미지 경로이며, 장부의 확정 판정일을 생성일로 대체하지 않는다.

기록된 참조 `references/sheep_flock-v1.png`의 inbox 복사본은 없다. 다만 `records/reference-hashes.json`에 저장된 참조 SHA256은 현재 `public/assets/zones/animals/sheep_flock-v1.png`의 SHA256과 일치한다. 단순 이름 대응보다 강한 바이트 근거이며, 상세값은 [provenance.json](provenance.json)에 있다.

## 판정 범위

로컬 시험은 계약·crop·pivot·공통 배율·정적 선택·이미지 fallback·봄 간격·기존 목초지 배치 회귀를 다룬다. 실제 게임 캡처와 화면 판정은 [README.md](README.md)의 별도 증거를 따른다. 원본 시트 자체를 네 방향 모두 확인한 사실을 네 방향의 실제 게임 노출 판정으로 대신하지 않는다. 이번 준비 저장의 기존 양 무리 좌표 (40,9)는 SE, (38,14)는 NE이며 SW/NW는 그 저장에서 노출되지 않는다.
