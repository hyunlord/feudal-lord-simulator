# R08 C — 현재 자산·설치계획 읽기 전용 검수

판정: **PASS_CURRENT_BYTES_AND_LEDGER_NO_CHANGE**. HEAD는 지정한 `5fb1aebfe735592c1424c947e88388d4ffe21742`다. R07의 ASSET_RECONCILIATION_R07.json, 그림 전략, 최종 보고 및 영주관 제한 조사 방법을 읽고 현재 파일을 직접 다시 해시했다. R07 결과를 복사해서 재검산으로 부르지 않았다.

| 검사항목 | 현재 결과 |
|---|---:|
| 장부 전체 | 5,885행 |
| confirmed / rejected / superseded / rework_pending / retired | 4,365 / 1,022 / 338 / 3 / 157 |
| confirmed·installed_by 공란 | 2,221행 |
| 계획 / 설치대상 외 제외 | 858 / 1,363행, 중복·미배정 0 |
| 계획 기존 대기 / 새 승인 승계 | 661 / 197행 |
| 실제 계획 원본 / 총 크기 | 858개 / 85,287,352바이트 |
| SHA·장부 상태·현재 줄·기재 크기·PNG 기재 치수 불일치 | 0 |
| 승인 랜드마크 | 44개, 동일 SHA·confirmed·미설치 |

장부 SHA는 `ef4ca1eec7c86319dc62aad21ee9a5cdb73dc90115ff3939a2cc4e4b768d58f5`, 계획 CSV SHA는 `8a1fc8484f1fe0498d104231eaece0c44c7840e843be2f4c4f1753bdbe663e17`로 R07과 같다. 197행의 canonical_ledger_path 공란은 ledger_file로 대조했으며 계획 셀을 임의 채우지 않았다. 전체 858행의 실제 SHA·크기·PNG 치수·장부 매핑은 ASSET_BYTES.json, 승인 44장은 APPROVED_44.json에 보존했다.

## 계획 파일과 우선순위

R07 install-plan-updated의 README.md, ORDER.md, INVENTORY.csv, REMOVED.csv, EXCLUSIONS.csv, R07_VISUAL_PRIORITY.md 여섯 파일을 R08 별도 폴더에 바이트 동일하게 복사했다. 각 복사 해시는 PLAN_COPY_PROVENANCE.json에 있다. 기존 역사 문서를 최신 실행 사양으로 오인하지 않도록 R08_CURRENT.md만 추가했다. 저장소, 원화, 승인 상태, 계획 CSV 행을 바꾸지 않았다.

기존 Wave12 영주관 A/B 연결 검증을 우선한다. [코드] buildingConfig.ts:430–435는 2×2 발판이고 buildingFootprint.ts:10–11이 이를 반환한다. buildingCatalog.ts:141–142에는 기본 몸체만 있고 facilityArt/spriteKey는 없다. [계획] wave12-manor 사양과 두 CSV 행은 416×328, 3×3 원화 발판, A(249,319)/B(251,319) native pivot을 적고 있다. 이 차이는 그대로다. 명시적 세계 접점 변환·안정적인 A/B 선택·실제 가문 점유/빈 상태 연결이 선행되어야 한다. 그림 때문에 엔진 발판을 자동 변경하거나 새로운 원화를 만드는 요청으로 바꾸지 않았다.

R07 화면의 기본도형 귀속은 기존 저장 좌표·카메라·소스 투영에 의한 제한 증거를 승계한다. 이번에는 새 이미지 판독·직접 선택·런타임 draw trace를 하지 않았다. 이를 새 렌더 결함이나 AS03 직업마당 위험의 재현으로 중복 집계하지 않는다. 승인 44장 재작업은 하지 않았다.

## 대상 파일 존재와 설치 완료의 구별

계획 target_path 중 실제 파일이 존재하는 것은 seal_slot 1개다. Wave41 원본 후보 SHA는 `8c1730d6f289647d3678bbf68d314eb0faa460ed5fbcdbccd9841a14182247be`, 현재 `public/assets/ui/seal_slot.png`는 `2ba82a986c35afe0c4e6d1aa5ffa7da24909a5f55e09f380679f6307f1688c91`이다. 장부 설치 필드는 공란이다. 같은 경로의 기존 파일을 새 후보 설치 증거로 해석하지 않고 현 상태를 기록했다. 장부 SHA 자체가 R07과 같으므로 새 설치 변화로 보고하지 않는다.

## 범위·재검증

경량 Ruby CSV/JSON/PNG 헤더·SHA 검사와 read-only git HEAD/source 조회만 수행했다. 엔진·브라우저·원격 실행, 소스·renderer·그림 수정, 커밋·푸시는 없다. 바이트 동일성은 픽셀 품질·가림·런타임 선택·설치 완료의 증거가 아니다. API 연결·시각 검수는 이번 완료 요건에 추가하지 않았다.

`ruby check.rb`로 같은 입력 대조를 다시 수행할 수 있다. source 핀은 SOURCE_PINS.json, 결과는 RESULT.json이다. 최종 재해시 검증은 VALIDATION.json에 기록한다. 산출물은 이 records/assets-current/와 별도 install-plan-updated/에만 썼다.
