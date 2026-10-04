# R08 현재 설치안 대조

기준 HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742`. R07의 여섯 계획 파일은 바이트 그대로 복사했다. 기존 README/ORDER의 R01 기준과 과거 줄 번호는 승계 이력이며 현재 검수 기준은 이 문서와 `../records/assets-current/REPORT.md`다. 역사 문서의 상대 증거 링크는 원래 `/tmp/astra-steward-r07-20261004/` 기준으로 읽는다.

현재 INBOX_LEDGER 5,885행, 설치 계획 858행, 실제 원본 858파일 85,287,352바이트다. SHA·장부 키·현재 줄·confirmed 상태·installed_by 공란을 대조해 불일치 0이다. 197행은 기존 규칙처럼 canonical_ledger_path 공란을 ledger_file로 보완해 대조했다. confirmed·미설치 2,221행은 계획 858행과 설치대상 외 EXCLUSIONS 1,363행으로 중복 없이 정확히 나뉜다. 설치 완료로 승격한 행은 없다.

## 기존 영주관 우선순위 유지

Wave12 A/B 두 원화는 priority_stage=1, pending_existing_plan이다. 현재 buildingConfig.ts:430–435는 manor_house 발판을 2×2로 정의하고 buildingFootprint.ts:10–11은 이 값을 반환한다. 현재 buildingCatalog.ts:141–142에는 기본 몸체만 있으며 facilityArt/spriteKey 연결이 없다. 계획의 416×328 원화 발판은 3×3, native pivot은 A(249,319), B(251,319)다.

설치 담당이 먼저 이 원화 좌표를 기존 2×2 세계 접점으로 연결하는 규칙을 명시해야 한다. 원화에 맞춰 엔진 발판을 자동 확대하거나 수평 중앙으로 대신 맞추지 않는다. seed/building ID의 안정적인 A/B 선택 및 실제 가문 점유·빈 상태 계약도 함께 확인한다. R07 세 카메라의 기본도형 귀속은 소스·기하 기반 제한 증거이며 새 런타임 검증이 아니다. 같은 장면의 교체·가림·접점, 겨울과 다른 방향은 설치 후 별도 검증한다.

승인 랜드마크 44장은 원본 SHA 및 confirmed·미설치 상태를 그대로 유지한다. 제작을 다시 열지 않는다. 성장 조건·발판·피벗 연결 계약은 별개이며, 이번 바이트 검수가 렌더 연결 승인이나 설치 지시는 아니다.

대상 경로가 이미 있는 1행은 Wave41 seal_slot이다. 원본 후보 SHA와 현재 대상 SHA가 다르고 설치장부는 공란이므로 파일 존재만으로 설치 완료라 부르지 않는다. 이번 감사는 전체 public/assets 설치 상태의 재판정이 아니다.
