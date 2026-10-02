# 눈가림 판별 결과 — 2026-10-03

**16/16, 맞힘률 100%. 목표70%이하 미달. 미술 채택 보류.**

제작에 참여하지 않은 새 AI 검수 컨텍스트16개가 각각 한 쌍만 판별했다. 이름은 blind01–blind16이며 각 컨텍스트에 정답, 제작 과정, 목표 맞힘률을 주지 않았다. 사람이 검수한 실험은 아니다.

## 절차

사전 절차는 `provenance/BLIND-PROTOCOL.md`. 표본은 납품하는5유형×3seed와 이웃18영지판 전체다. 원본에 거점이 없어 조립판도 `--terrain-only`로 거점·깃발만 숨겼다. 나머지 수계·길·밭·지형은 동일하다. 실제 납품본은 거점·깃발을 포함한다.

두 입력 모두1600×1000, JPEG quality92→88, 4:4:4로 정규화했다. 메타데이터와 제목을 제거하고 A/B로만 제시했다. 조립본 좌우는8개씩, 고정 난수 `blind-20261003-fixed`로 배분했다. 매 검수자는 오직 자기 쌍 두 이미지에만 접근하도록 지시받았다. 모든 판별을 그대로 집계했으며 제외·재투표하지 않았다.

| 시험 | 대응 납품 지도 | 조립본 정답 | 응답 | 판정 | 확신 |
|---|---|---|---|---|---|
| 01 | chalk_downs-seed17.jpg | A | A | 맞힘 | 0.99 |
| 02 | chalk_downs-seed241.jpg | B | B | 맞힘 | 0.99 |
| 03 | chalk_downs-seed83.jpg | B | B | 맞힘 | 0.99 |
| 04 | coastal_port-seed17.jpg | A | A | 맞힘 | 0.99 |
| 05 | coastal_port-seed241.jpg | B | B | 맞힘 | 0.99 |
| 06 | coastal_port-seed83.jpg | A | A | 맞힘 | 0.99 |
| 07 | fen_drainage-seed17.jpg | B | B | 맞힘 | 0.99 |
| 08 | fen_drainage-seed241.jpg | A | A | 맞힘 | 0.99 |
| 09 | fen_drainage-seed83.jpg | A | A | 맞힘 | 0.99 |
| 10 | forest_edge-seed17.jpg | B | B | 맞힘 | 0.99 |
| 11 | forest_edge-seed241.jpg | B | B | 맞힘 | 0.99 |
| 12 | forest_edge-seed83.jpg | B | B | 맞힘 | 0.99 |
| 13 | neighbor-18.jpg | A | A | 맞힘 | 0.99 |
| 14 | open_field-seed17.jpg | A | A | 맞힘 | 0.99 |
| 15 | open_field-seed241.jpg | B | B | 맞힘 | 0.99 |
| 16 | open_field-seed83.jpg | A | A | 맞힘 | 0.99 |

## 해석과 한계

주요 판별 단서는 반복되는 밭·숲 실루엣, 비슷한 방향의 능선, 지나치게 고른 강 폭과 곡률, 해안 경계였다. 알파 가장자리 수정만으로는 원본의 연속된 지형 구성을 재현하지 못했다. 구조적으로 작동하는 조립 시제품과 원본에 버금가는 미술 품질을 구분해야 한다.

단일 원본, 서로 겹치는 키트 자산, AI 검수자, 표본16개라는 한계가 있다. 컨텍스트는 분리했지만 통계적으로 독립된 사람16명을 뜻하지 않는다. 확신0.99는 각 모델의 자기 보고이며 보정된 확률이 아니다. 사람 대상 식별률이나 상용 채택 근거로 일반화하지 않는다.

`provenance/blind-key.json`은 입력 해시와 정답, `provenance/blind-results.json`은 원응답·근거·집계다. `proofs/blind/trial-XX.jpg`는 왼쪽A/오른쪽B 축소 검수판이다. 원본 크기의 눈가림 입력은 로컬 `/tmp/ck-map-blind-20261003/`, 응답은 `/tmp/ck-map-blind-results-20261003/`에 보존했다. 키를 공개했으므로 이 파일로 같은 검수자를 다시 시험하면 눈가림이 아니다.
