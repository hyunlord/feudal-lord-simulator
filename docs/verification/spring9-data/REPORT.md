# Spring9 후보 데이터 — 본선 캡처 대기

**후보 데이터 반영·정적 검사 PASS. 아직 미커밋이며 main data runtime은 NOT_RUN.** 기존 core `208c622222b2d2a2b7d0aa883d6a598984b25ca4`의 실제 10뷰 검증 뒤 적용했다. 이 문서는 새9 설치 완료나 installed_by를 주장하지 않는다.

## 이번 데이터 범위

17개 파일 작업: catalog1, 승인 PNG9, provenance CSV1, 옛 봄 public 중복6 제거. 신규9는 candidate, 옛6은 retired로 출처 경로를 보존한 inbox 원본으로 옮겼다. 모든 원본 픽셀과 옛6 source SHA는 유지한다. CSV의 나머지2412 literal 레코드 및 W37 설치 장부16행·전체 SHA는 그대로다. 정확한 경로·전후 SHA는 transfer-receipt.json, provenance 행은 retirement.json에 있다.

catalog92→95, season contract20→23, legacy45 유지, 활성 계절 이미지65→68. catalog 외 제품·scripts·tests·관련 JSON2342파일은 core와 같다. 최신 역사65 영수증/활성 provenance 시험과 기존 provenance 열거기 수정도 공통 기준선에 포함된다. 새 소비자 코드나 스키마를 추가하지 않았다.

## 본선 작업 트리 정적 검사

집중 시험37/37, catalog95/95, provenance2384/2384(누락·고아·해시·파일 오류0), 새 봄 선택63건·비봄 보존189건, capture validator10뷰 PASS. 상태·저장8파일은 core와 바이트가 같고, 봄3뷰의 expectedRequests만 새9로 바뀌며 비봄7뷰는 동일하다. 후보 fixture의 기존 metadata는 과거 기록이며 새 runtime 결과가 아니다. 타입·린트는 코드 변경0이므로 core 결과 이후 반복하지 않았다.

## 역사 detached 증거 — 현재 본선 결과와 구분

첨부 JPEG·manifest는 `astra-season-spring9-v2-ab67dcb`의 실제 detached10뷰다. 봄3뷰는 의도된 변경, 비봄7뷰는 RGBA 동일, A/A10·오류0을 확인했다. 여름·겨울1.0/0.6 네쌍과 봄1.0/0.6/1.4 세쌍의 원PNG SHA·RGBA·capture identity·remote freeze를 manifest가 연결한다. JPEG는 손실압축 열람본이며 원본 비교를 대체하지 않는다. 독립20PNG 검토와 부모 검토는 첨부 원문 범위의 과거 판정이다.

이 detached 증거를 미래 data commit 캡처로 재명명하지 않는다. 다음 관문은 정확한 data commit의10뷰 실제 캡처, 새9 도달, 비봄7 보존 및 독립 시각 검토다. 이후 최종 가지의 회귀·기하 입력 판정·clean clone·게시도 별도다. package SHA256SUMS.json은 자신을 제외한 모든 파일을 검증한다.
