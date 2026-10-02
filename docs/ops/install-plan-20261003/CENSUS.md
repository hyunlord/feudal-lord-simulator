# 설치 대기 행 전수 분리

장부 5,393행 중 `status=confirmed`이고 `installed_by`가 빈 행은 **1,984행**이다. 원래 일곱 열을 그대로 보존하고 장부 행 번호, 묶음, 제외 사유 및 근거, 중복 정본, 설치 대장 대조 결과를 덧붙였다.

- 게임용 그림: **803행 / 803개 SHA-256**, 38개 wave/batch 묶음.
- 게임 설치 대상 아닌 기록·자료·상점 홍보: **1,181행**.
- 두 CSV의 경로 합집합은 정확히 1,984개이며 겹치는 행이 없다.
- 게임용 803개 원본 경로는 클론에 모두 존재한다. 본 납품의 별도 `VALIDATION/SOURCE_VERIFICATION.json` 검증에서 803개 실제 바이트 SHA가 모두 장부와 일치했고, public 전체 바이트 및 caBX 제거 바이트 대조도 아래 59행과 정확히 일치했다.

## 제외 근거

|종류|행 수|근거|
|---|---:|---|
|proofs / records / checks|1,085|`docs/ASSET_INBOX.md` 1·2절의 보관 역할과 개별 장부 비고. records 713, proofs 371, checks 1. 상태는 확인하는 묶음을 따르므로 confirmed가 설치 승인을 뜻하지 않는다.|
|방식 시험 비교 그림|2|asset-trial의 두 PNG, 장부에 확인 그림 명시. assets 폴더라도 제외.|
|파생 참조 템플릿|4|derived-templates의 네 PNG, 장부에 Astra 산출물 아님·설치 안 함 명시. 같은 묶음의 확인판 1장은 위 proofs/checks에 포함.|
|워커 제작용 마스터·정규화 템플릿|68|`assets-inbox/walker-pilot2/candidates-v1/records/README.md` 3·13·22행. 납품용 20개 = workers 4시트 + props 16장, masters 20장과 templates 48장은 제작 중간 자료.|
|Steam 상점·라이브러리·바로가기 홍보 그림|11|wave24 원화 7장 + 후처리 4장. 게임 렌더 설치 범위 밖. 기록 그림으로 오인한 것이 아니라 별도 외부 홍보 자료로 보존.|
|울타리 위상 마스크|5|wave4c 장부에 보조 자료(기록)·게임 코드 미사용. 해당 README 10행에서도 구조 마스크로 분리.|
|옛 워커 파일럿 참조 초상|6|wave5a/portraits 장부에 ‘인물 파일럿 초상(E단계 확정, 기록용)’ 명시.|

경로 구조와 역할 문서를 먼저 사용했다. ‘눈가림’, ‘확인’ 같은 단어의 유무만으로 제외하지 않았다. **strip-corners 16장**의 비고에는 눈가림 시험 성적이 있지만 실제 설치할 성벽 모서리이므로 포함했다. Wave 35의 9-slice 조립용 부품과 32px 파생 부품도 실제 런타임용이므로 포함했다.

## 장부 공란과 실제 미설치 구분

게임용 803행 가운데 **59행**은 이미 설치된 다른 장부 행과 SHA가 같거나 설치 대장의 sourcePath/sourceSha256/runtimeSha256과 맞는다. `INSTALL_LISTS/legacy-reconcile.json`에 분리했다.

- Wave 7 재작업 묶음의 original-assets 58장: 정본은 candidates-v1 쪽이며 `installed_by=INSTALL-7`이다. 받은 사본의 공란을 새 설치 요청 58개로 세면 중복이다.
- Wave 17 `prop/refugee_child_sheet-v1.png` 1장: 설치된 Wave 9 `prop/leaving_child_sheet-v1.png`와 같은 바이트. 설치 대장 assetId `prop_leaving_child_sheet`, 정본 설치 작업 `UI-4`.

따라서 **추가 설치 후보는 744행**이다. 본 납품의 별도 `VALIDATION/SOURCE_VERIFICATION.json` public 전체 바이트 및 caBX 제거본 대조에서 같은 59행의 기존 설치 바이트를 확인했다. 설치 대장 및 바이트 일치는 렌더가 현재 그 그림을 선택한다는 증거와는 다르다.

## 재현 및 보존

원본 CSV를 정상 CSV 파서로 읽고 `status == "confirmed"` 및 `installed_by.strip() == ""` 조건을 함께 적용하면 대상 1,984행이 나온다. `METADATA/pending_game.csv`와 `EXCLUSIONS.csv`는 원본 일곱 열을 유지하므로 다음을 대조한다.

1. 두 파일의 `file` 집합 교집합이 공집합인지 확인한다.
2. 합집합이 위 조건으로 추출한 원본 1,984개 경로와 정확히 같은지 확인한다.
3. 각각 원본 일곱 열 값이 같은 장부 행과 일치하는지 확인한다.
4. `INSTALL_LISTS/legacy-reconcile.json` 59행은 pending_game의 부분집합이며, 전체 합산에 다시 더하지 않는다.

원본 장부·게임 코드·설치 대장은 수정하지 않았다. 조사 스크립트는 작업 도구이며 납품 실행 도구로 요구하지 않는다.
