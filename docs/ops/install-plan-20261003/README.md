# 설치 대기 그림 실행 준비서

> 저장소 메모(INBOX, 2026-10-03): `SPECS/strip-corners.md`의 성벽 띠 모서리 16장은 렌더 NAT-5 그리기 이음으로 대체되어 retired — 이 계획에서 빠진다. 0단계(legacy-reconcile 59장)는 INBOX 세션이 처리했다. `INSTALL_LISTS/*.fragments.ts` 3개는 저장소 ESLint가 TS로 읽지 않도록 `.fragments.ts.txt`로 이름만 바꿨다(바이트 동일, SHA256SUMS·문서 속 이름은 원본 그대로).

기준 브랜치 `codex/phase15-organic-ground`, HEAD `ce67158a7f2d24bf8d02cab45deb9b7209ed68e1`, 조사일 2026-10-03.

먼저 [ORDER.md](ORDER.md)의 순서를 따른다. [INVENTORY.csv](INVENTORY.csv)는 게임용 장부 공란 803행을 보존한다. `action=ledger_reconcile` 59행은 파일을 다시 설치하지 않는다. 실제 추가 설치 후보는 `install_new` 또는 `replace_existing` 744행이다. 확인·기록·제작 중간물·외부 상점 홍보 1,181행의 제외 근거는 [EXCLUSIONS.csv](EXCLUSIONS.csv)와 [CENSUS.md](CENSUS.md)에 있다.

`ledger_file`은 assets-inbox 기준 상대 경로, `source_path`는 저장소 기준 경로다. `bundle`은 수령 wave/batch, `install_group`은 같은 렌더 계약을 사용하는 실행 단위다. `classification`은 가(기존 그리기 경로에 데이터/원본 추가), 나(기존 엔진 상태에 선택·배치 연결), 다(새 화면/표현 기능 또는 상태 계약)다. 이미 설치된 별칭에는 가 대신 별도 `장부정리`를 부여하여 설치 난도 수를 부풀리지 않았다.

`target_path`는 설치자가 만들거나 교체할 저장소 경로이며 이번 납품에 그림 복사본을 넣지 않았다. `target_before_sha256`가 있으면 기존 파일 교체다. `source_sha256`는 받은 바이트, `metadata_stripped_sha256`는 PNG C2PA 청크만 제거한 바이트의 실측값이다. 설치자가 추가 파생본을 만들면 그 결과 SHA를 새로 기록해야 한다. `rgba_nominal_bytes=width×height×4`는 원본 한 벌의 단순 계산이며 브라우저/GPU 실제 메모리나 총 피크가 아니다.

[INSTALL_LISTS](INSTALL_LISTS/)에는 가 묶음별 삽입 위치·카탈로그 조각·source→target 목록이 있다. 조각은 설명에 지정한 객체/배열 안에 넣는 코드이며 독립 실행 모듈이 아니다. [SPECS](SPECS/)는 나·다의 엔진 연결·배치·줌·캡처 관문이다. 원 납품 규격은 [METADATA](METADATA/)에 출처와 함께 보존했다. 원본 기록의 candidate 표기는 수령 당시 상태이며 설치 승인 판정은 기준 HEAD의 INBOX_LEDGER confirmed가 우선한다.

문서에 인용한 `src/`, `docs/`, `assets-inbox/`, `scripts/`, `tests/`, `fixtures/`, `public/` 경로는 **기준 저장소의 외부 근거**다. ZIP 내부 산출물 링크와 구분한다. 과거 제작자의 절대 경로는 원본 메타데이터의 출처 기록이며 설치 입력으로 사용하지 않는다. 설치 입력은 INVENTORY의 source_path뿐이다. 다른 세션 폴더에 의존하는 실행 단계는 없다.

이번 작업은 읽기 전용 감사다. 게임 코드·장부·public를 수정하거나 커밋·푸시하지 않았다. 실화면 설치 검증은 실행하지 않았으며 계획의 캡처 관문은 모두 설치 세션이 수행할 후속 작업이다. [VALIDATION/REPORT.md](VALIDATION/REPORT.md)는 이번 납품 검증만 보고한다.
