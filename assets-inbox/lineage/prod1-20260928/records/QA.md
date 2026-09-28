# 검수표

| 항목 | 판정 | 근거 |
|---|---|---|
| 요청 범위160장·확인4장·CSV160행 | PASS | technical-qa.json, proof-layout.json, csv-validation.json |
| PNG256×256 | PASS | 전체 파일 메타데이터 검사 |
| 후보 전용·게임 미설치 | PASS | output 폴더와 /tmp 납품만 생성 |
| 가족 공통3·개인 차이3이상 기록 | PASS | TRAITS.md / assets.csv; 외부 배우자는 가문 공통 비적용 |
| 후손 양친 실제 입력 | PASS | 세 혈통 기록, 보존 참조SHA검사 |
| 아기0–2·보닛·포대기 | PASS | common-baby-independent-qa, 각 가문 final-visual-qa, pilot2-baby-independent-qa |
| 어린이6–9 | PASS / 연령 추정 폭 있음 | final-child-refinement-qa가 교정 전6개 판정을 대체. C_child_07은5–7세 추정 |
| 장년+20년 | PASS | 나이 계약24장 및 교정 후 독립 노화 검수. L3/L4/L5 보고서 최신해시 기준 |
| 기혼 성인 여성 머리 가림 | PASS | 단계별 marital_status와 가문 시각 검수 |
| 가족 묶기80% 이상 | PASS | 28/30(93.3%) |
| 같은 사람18쌍 | PASS | 96px18/18, 256px18/18 |
| 공통 풀 성비 | PASS | 아기7/7, 걸음마6/6, 어린이7/7 |
| 머리색5종 시각적 수량 | REVIEW | 아기 보닛과 희박한 머리숱 때문에 정확한 시각 계수 미확정 |
| 원본·프롬프트·참조 보존 | PASS | generationRecords234건 및 SHA256SUMS |
| 기존 승인본 보존 | PASS | 104개 해시 불변 |
| 실제 게임 통합 | 미실시 | 사용자 요청대로 후보만 납품 |

교정 전 FAIL/REVIEW 기록은 삭제하지 않았다. 파일별 SHA가 최종 frozen.json과 다른 기록은 해당 이전 시도에 대한 판정이다. 최신 어린이6개와 장년6개 재검수는 과거 약한 노화/연령 지적을 대체한다. 모든 시각 판정은 AI 검수자의 추정이며 인간 사용성 시험은 아니다.
