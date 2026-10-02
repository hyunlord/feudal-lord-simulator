# Charter & Kin — 랜드마크 성장 후보

> 저장소 메모(INBOX, 2026-10-03): `proofs/blind/R01–R12.png`는 `proofs/city-*.png`와 같은 바이트라 넣지 않았다 — 대응은 `records/proofs/answer-key.csv`(id → source), 원본은 astra-raw. `references/`는 제외. 문서·JSON·CSV는 `records/`(검수는 `records/proofs/`, `manifest.csv`도 `records/`)로 옮겨 아래 링크 경로와 다르다.

7계열22단계, 여름·겨울 완성 PNG44개. 게임 미설치, 코드·커밋·푸시 변경 없음. 이 묶음은 설치본이 아니라 검토용 후보 패키지다.

- `LANDMARKS.md`: 현행 엔진/없는 단계, 역사·시기·조건부 투자 연결.
- `assets/manifest.csv`:44개 그림의 단계·계절·캔버스·공통 피벗·월드 축척·제안 부지와 확장 규칙.
- `proofs/city-*.png`: 같은 도시1300/1380/1450 × 여름/겨울 × 줌1.0/0.6,12장.
- `proofs/identity/`:7계열×2계절, 실제 축척과2배 확대의14개 비교판.
- `proofs/VERDICT.md`: 독립 평가자의 눈가림 시대 판별과 같은 건물 성장 판정. 정답표와 원 응답도 보존.
- `records/GEOMETRY_AUDIT.md`: 사람 크기·기준점·투영 잔차. **엄격한2:1 투영은 미통과**이므로 시대 판별 성공과 혼동하지 않는다.
- `SOURCES.md`, `records/PROVENANCE.md`, `records/prompts/`: 근거와 생성·수정 이력.
- `SHA256SUMS`: 이 파일 자체를 제외한 모든 ZIP 내용의 SHA-256.

정적 합성은 실제 게임 캡처가 아니다. 등록검사는 통과했지만 런타임 통행·가림·충돌·성능은 미검증이다. raw 원본·폐기 시안은 경량화를 위해 ZIP에서 제외했고 원본 해시와 변환 기록은 포함했다.

도시 비교판은 ZIP을 푼 폴더에서 `python3 records/tools/compose_city.py <폴더>`로 재현할 수 있다(Pillow 필요). 평가를 재현하려면 먼저 기존 `proofs/blind/`와 정답키를 보존해야 한다. 합성 재실행은 눈가림 ID를 새로 섞으므로 기존 평가 응답과 새 ID를 섞지 않는다.
