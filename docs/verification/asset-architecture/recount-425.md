# 원본 나425 — 현재 설치 회계와 역사 기준

현재 기준은 게시된 `90d9b5865bee4dc012f49f6eded135ac85975e78` 위 W37 installed_by16 조정 working tree다. W37 작업 commit과 그 뒤 after4는 아직 대기다. LM-R1 본선 `57228cc1`, 공통 코어 `d60ababf`, Wave20 데이터 커밋 `541a0811`을 포함한다. **[recount-425.csv](recount-425.csv)는 d4973e85 기준425행 역사 기록으로 그대로 보존한다.** 그 CSV의 current_*, data_only_add_now, runtime_verified_this_audit는 당시 판정이며 현재 설치 장부가 아니다.

현재 변경112행은 [recount-current-delta.json](recount-current-delta.json)에 원본 row index(헤더 제외1부터)와 exact original_ledger_file로 연결한다.425개 ID를 다시 쓰거나 삭제하지 않았다. JSON이 고정한 baseline CSV SHA로 동일한 원본인지 확인한다. 나머지313행은 역사 baseline의 설치 상태를 유지한다.

## 검증한 현재 수량

| 회계 | 기존 d497 | LM-R1 증가 | ASSET-ARCH-1 증가 | W37 조정 | 현재 |
|---|---:|---:|---:|---:|---:|
| exact source/provenance/runtime byteproof |42|80|32|0|**154**|
| installed_by 비어 있지 않음 |42|60|32|16|**150**|

예상치를 복사하지 않고 현재 INBOX_LEDGER와 provenance를 exact source 경로로 조인했다.154행의 source PNG SHA는 역사 CSV와 같고 현재 runtime 파일 SHA는 provenance와 일치한다. 변경112행 모두 이를 만족한다. 신규112 runtime SHA는 source SHA와도 같으며 그 판정을 compact JSON에 저장했다. source SHA 원문은 고정 CSV에 있어 반복 저장하지 않는다.

| 현재425의 상호배타 상태 | 수 |
|---|---:|
| 설치 표기 있음 |150|
| byteproof 있음, 설치 표기 없음(Wave37) |4|
| active, 위 byteproof 없음 |255|
| retired |16|
| **합계** |**425**|

설치 표기 없는 active259=4+255다.259를 새 파일 설치 필요량으로 읽지 않는다. byteproof154도 전부 새 runtime 검증154라는 뜻이 아니다. 이번 회계 갱신은 기존 검증 자료를 연결하며 브라우저/DGX 검증을 새로 수행하지 않았다.

## LM-R1과 이번 B 데이터 설치를 분리

| original group | 추가 byteproof | 추가 설치표기 | 근거 |
|---|---:|---:|---|
| wave12-manor |4|4|LM-R1 manor6 중 원본425에 속하는4|
| wave35-receipts |4|4|LM-R1 영수증 소비자|
| wave37 |32|28|기존 LM-R1 12 + 관측 완료 W37 조정16; fisher/shepherd4 공란 유지|
| wave38 |40|40|LM-R1 버튼/조작40|
| wave20-era |32|32|B 공통 코어와 분리된 데이터 설치, ASSET-ARCH-1|
| **합계** |**112**|**108**|기존42에 더함|

[LM-R1 보고서](../lmr1/REPORT.md)4절은 Wave37 미표기20의 원인을 명시한다. 목자·어부는 해당 상태 공급이 없고, 일부 직업은 해시/자리 또는 캡처 도달 부족이다. 그중 실제21뷰에서 사용이 확인된16행은 이번에 `RENDER-B-W37`로 표시했다. fisher/shepherd4만 공란으로 남긴다. [조정 보고서](../wave37-reconcile/REPORT.md)의 d677 after-reference는 과거 자료이며 신규 작업 after4는 대기다. 영주관 빈판2는 원본425 바깥이므로 더하지 않는다. LM-R1의 legacy consumer 연결과 새 generic art-contract capability는 동일한 회계가 아니다.

## Wave20 32: 설치 가능한 후보에서 설치32로

역사 CSV의 data_only_add_now=true32는 Wave20였다. 지금은 해당 원본32 모두 catalog/public/provenance와 installed_by=ASSET-ARCH-1이 있으며 더 이상 “미설치 준비32”로 남겨 두지 않는다. 코어 d60ababf와 데이터541a0811의 분리는 그대로 증거로 유지한다. 새32 + 재사용 기존 Wave7 overlay4 =36entries이지만 재사용4를 신규32/원본425 증가에 더하지 않는다.

[Runtime coverage](runtime-coverage.md), [machine-readable observations](runtime-coverage.json), [독립 시각 비교](visual-data-independent.md)는 분리된 DGX prepared data proof에서 요청·응답·정확 치수 decode·canvas draw lineage와8화면 비교를 기록한다. 이 회계 업데이트가 그 캡처를 e370716d에서 새로 실행했다는 뜻은 아니다. 최종 본선90d9의 clone4820/4820·build·check:merge 및 보호된 push0은 확인됐다. 이 완료는 이번 W37 post-ledger after4 대기를 해소하지 않는다.

현재 원본425에서 **검증된 미설치 data-only 후보32는0으로 소진**됐다. 공통 house consumer capability가 사라진다는 뜻이 아니라 그32 의무를 수행했다는 뜻이다. era1420 house3는 레이어 registration 미검증, storehouse snow3는 기존 byteproof이며 house consumer 확장을 의미하지 않는다. 다른 그림을 이32의 성공만으로 자동 준비 완료로 승격하지 않는다.

## 나머지 분류의 처리

기존 CSV의 준비 분류는 원본 사실과 당시 한계를 보존한다. 설치된112를 제거한 active 미입증255의 역사적 분포는 화면/입력 소비자 인계116, generic 소비자 미이전64, 사실/배치 의미 미해결71, house registration 미검증3, 소비자 경계 미확정1이다. 이255를 이번에 전수 재설계·재검증한 것은 아니다. UI그림 계약/파일 설치는B, 화면/입력은A라는 소유권 경계도 유지한다.

Wave37은 현재 legacy world consumer가 존재하므로 역사 CSV의 “world consumer 없음” 설명을 현재 사실로 쓰면 안 된다. 역사상 미표기20 중 관측16은 조정됐고, 남은4를 파일 추가가 아닌 사실 공급/검증 문제로 구분한다.10kind geometry adapter 존재만으로 다른 개별 소비자의 사실→선택→배치→load→draw 연결 완료를 주장하지 않는다.

## 데이터 보존과 범위

원본 CSV568KB를 다시 쓰지 않았다. JSON112행+기존CSV313행으로 exact425를 추적한다. 이번에는 장부 installed_by16과 담당 문서·증거만 바꿨다. 제품·그림·provenance·역사CSV는 수정하지 않았다. 원본425 회계150marks/byteproof154와 Wave374 미표기·retired16을 대조했다. 원래 LM-R1/ARCH1 계산 및 d677 clone실패 이력은 보존한다. 신규 전체회의 runtime 사실은 해당 캡처 증거 범위를 넘어서 주장하지 않는다.

W37 실제 후속 검증: `bc29f6b2`의 여름·겨울×줌1/.6 네 장을 새로 촬영해 전후 identity/RGBA 차이0·A/A4·오류0을 확인했다. 장부 수량150/4/255/16과 byteproof154는 그대로이며 후속 가지 게시 관문은 아직 남아 있다.
