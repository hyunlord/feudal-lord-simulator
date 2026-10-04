# R08 상위 10개 미해결 항목 — 최소 재현근거 인계안

**추가 제안 55파일, 37,334,949바이트(약35.61MiB).** 선정64파일 중9개는 현재 R08에 동일 경로 계열·동일 SHA로 이미 있다. 사진은 전체6장이다. 복사·실행·원본 수정은 하지 않았다. `COPY_NEEDED.json`은 빠진55개, `EVIDENCE_FILES.json`은 기존9개를 포함한 전체 대응표다. 각 항목에는 source, destination, bytes, SHA256, 이유와 연결 결함ID가 있다.

기준은 `records/status-midround/STATUS.md`의 상위10이다. 실제 ZIP은 아직 없어 현재 R08 작업 폴더의 포함 파일과 대조했다. 부모가 이 목록을 복사하고 최종 root manifest로 검증해야 ZIP에 근거가 들어간다. 과거 모든 링크의 closure나 모든 helper를 즉시 실행할 수 있는 번들은 아니다.

## 결함별 입구와 재현 범위

|ID|이미 있음 / 추가 제안 수|입구·재현 조건·포함 근거|
|---|---:|---|
|SAVE01|0 / 6|R03 records/N01-failure/RESULT.md. seed1/open/full, HEAD5fb, t560000 원본 latest.fls.json과 metadata, SNAPSHOT_AUDIT, 원본 Buffer→decodeSave 거부 run.log/exit. 다른150년 정상저장으로 대체하지 않음. UI 사진은 관측 없음.|
|A02|0 / 7|R04 DEAD_STEWARD_RESULT_R04.md. seed2/chalk/full 자연 t600000, est-000021(1435 사망), set_estate_oversight 명령의 실제 before/after 저장·개별 결과·6경로 총괄/부모검산. 자연 직접선임과 합성 감사경로를 구별. UI 관측 없음.|
|A05|0 / 4|R07 registry-atomic-r05-inherited/A05_CURRENT_RESULT.md 및 raw result/부모검산/run.log. seed1 lord초기 t0·금고60·장려금 한도15, 합성7+9 중7만 적용해도 non-null/활성. 시간진행0이며 자연사건/UI/codec 재현 아님.|
|B02|0 / 8|R07 post-petition-ui/REVIEW.md/PREFLIGHT/SOURCE_DIAGNOSIS. seed1 t100000, market_charter@25000 이미 수락. 실제 방향잠금 사진0009+DOM, actions, 원래1325 저장.|
|B03|0 / 10|B02와 같은 fixture/공통검수 공유. receipt98 tick49764, 자율 storehouse construction-site-000039 (41,45). 실제 상세 상단0026과 native scrollbar 최하단0028의 사진2장+DOM 둘 다 필요. 이 한 inspector의 원인표시 부재로 한정.|
|B01|0 / 7|R07 natural-firstplay-r07 보고/소스/기존증거핀, R05 실제 title DOM·goal초기0007 사진+DOM·DIAGNOSIS. 정상 lord 새진입을 목표형 집놓기CTA·fixture로드와 구별. 장기저장 seed/tick을 이 초기화면에 임의 귀속하지 않음.|
|A01|0 / 6|R01 PERF_RUNTIME/PERF_SOURCE_REVIEW, seed1/open/full HEAD5ad의 t60000 repro-1315 저장, 실제 CPU profile16KB·summary·stack02. 60450직전 정확저장이 아니며 같은 봇 진행 필요. 사진·브라우저 프로필 없음. 623/646 표본은 벽시계96%나 무한루프 증명이 아님.|
|E02.factline.seven|4 / 0|현재 R08 records/factline-copy-review의 REVIEW/FACTLINE_VERDICTS/COMPOSITION_VERDICTS와 proposal SOURCE_EVIDENCE. 7개의 producer↔기본문구 의미불일치. 실제 UI 반례사진이 있다고 만들지 않음.|
|ledger.purpose.three|5 / 0|현재 R08 records/ledger-purpose-review의 REPORT/REVIEW/INDEPENDENT_SOURCE/STALL_INDEPENDENT 및 context PROPOSAL. 3범주·6문구·실제 producer 용도 근거. medium_candidate 유지, runtime설치/UI 확인 아님.|
|B04.restore-affordability|0 / 13|R07 restoration-probe 부족15d/가격50d 합성 t12001 before/after, 결과/검수와 deadline INPUTS·실행보고·result/boundaries. t16001 하한과 해당경로17000 첫계절 재청원 구별. R05 실제 UI 직전0115/직후0118 사진2장+DOM도 별도로 포함. 자연 UI의 원 runtime petitionID는 미확보이며 합성 ID와 같다고 하지 않음.|

B02/B03는 동일5개 보고·로그와 동일1325 저장을 공유하므로 표의 추가 수를 단순 합하면 안 된다. 파일 기준으로 중복 제거한 최종 추가 수가55개다.

## 선정 이유와 과거 출처

장기127 승계의 start/final/annual은 SAVE01 실패 저장이나 B02/B03의1325 중간 fixture를 대신하지 못한다. A02의 명령 직전/직후 저장도 자연 판 final 자체와 서로 다른 아티팩트다. D/E605 승계는 의미 검수 입구를 이미 갖고 있어 해당9개를 다시 복사하지 않는다. 흔한 exit-code `0` 파일처럼 우연히 바이트만 같은 다른 실행자료를 대체 근거로 채택하지 않았다. 동일 상대경로 계열로 확인하며, 실제 save는 바이트 동일일 때만 별도 경로 재사용을 허용했다.

R07은 이전 결함을 보고에 승계했지만 그 원래 입력을 모두 재복제하지 않았다. 그래서 SAVE01은 R03, A02는 R04, A01은 R01, 초기 진입/복원 UI는 R05의 실제 원본을 source로 명시했다. 제안 목적경로 `inherited/top10/<원래회차폴더>/...`가 이 계보를 보존한다. 현재 미해결 표를 새로 발견·재현했다는 뜻이 아니다. 과거 HEAD5ad의 A01을 현행5fb 프로파일로 바꾸어 쓰지 않는다.

사진은 기존 검수 보고가 실제 관측했다고 명시한 파일을 선정했다. 이번 인계 작업에서 새 시각 판정이나 UI 재실행은 하지 않았다. B03의 부재 주장에는 상단 한 장만으로 부족해 상·하단2장을 유지했다. B04의 전후는 서로 다른 정확 시점의 최소쌍이다. 브라우저 프로필·전체 스크린샷 묶음·대형 진단 dump는 포함하지 않는다. A01 debug-profile.json은 실제16KB CPU 샘플 원자료이며 브라우저 user-data profile과 다르다.

## 전달 후 검증과 한계

부모는 `COPY_NEEDED.json`의 source SHA를 확인한 뒤 destination에 복사하고, 기존9개는 EVIDENCE_FILES의 existingR08Paths로 찾으면 된다. 모든 파일을 원본 그대로 유지한다. 원본 내부 절대 경로와 링크를 무조건 재작성하거나, 새촬영·새실행으로 표시하지 않는다. 최종 ZIP rootSHA로 전체 포함 바이트를 검증하되 역사 manifest가 가리키는 비선정 형제파일까지 모두 들어 있다고 주장하지 않는다.

이 목록은 **문제 서명을 다시 조사할 구체 입력·실측 응답·관측 화면의 최소 입구**다. 원UI 클릭 가능 fixture·전체 원격실행환경·소스 checkout·모든합성통제의 전후저장을 모두 제공하는 완전 replay 환경은 아니다. A05는 결과에 입력구성이 있으나 새 standalone fixture파일이 있는 것처럼 꾸미지 않았다. SAVE01의 직접 decoder 오류에는 사진을 요구하지 않는다. E02/목적3의 소스기반 발견에 임의 자연 seed/tick을 붙이지 않는다.

실제 파일 존재·크기·SHA 대조만 수행했으며 검증 결과는 RESULT.json, 입력 목록 핀은 INPUT_SHA256.json이다. 회차 미마감의 상태파일을 수정하지 않았다.
