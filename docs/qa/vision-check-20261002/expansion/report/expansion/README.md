# 시각 자연스러움 검사기 확장 납품

먼저 PRECISION.md를 읽는다. 정답38개를 먼저 고정하고 기존 도구와 개선 도구를 같은14장면에서 비교했다. 정상 재고 반복 제외, 복합 그림 부위 분리, 검출기별5개 이상 양성 시험지를 포함한다.

- `truth-*-frozen.json` + `.sha256`: 선행 동결 정답과 합본.
- `baseline-findings.json` / `enhanced-findings.json`: 모든 후보.
- `baseline-benchmark/` / `enhanced-benchmark/`: TP/FP/FN/미평가 및 공식 공간 대응.
- `FINAL_REVIEW_TABLE.md`, `FINAL_OBJECT_REVIEW.md`, `FINAL_MATCH_REVIEW_*.jpg`: 실제 원본 대조 판정.
- `SCENE_PROVENANCE.md`, `INPUT_SHA256.json`, `REPOSITORY_STATE.json`: 저장·카메라·커밋·원본 계보.
- `enhanced-provenance.json`, `enhanced-runs.json`, `VALIDATION.json`: 실제 실행 및 검증.
- `metadata/<scene>/capture.json.gz`: 원본 메타데이터의 무손실 gzip. 게임 자산과 PNG20프레임은 경량 ZIP에 넣지 않음.
- `annotated/`: 대표 개선 검출 JPEG. 일부 detector는 다른 프레임에서 판정하므로 measurement_frame를 따른다.
- `baseline-tool/`: 이전 도구 소스 snapshot. 재현 비교용이며 새 코드 대신 설치하지 않는다.

404개 후보 가운데 주석 ROI 밖369개는 미평가다. 따라서 여기서 보고한 정밀도는 전체 화면 정밀도가 아니다. 코드·문턱을 같은 정답으로 교정했으므로 외부 holdout 성능으로도 해석하지 않는다. 작은 N과 같은 원인/도시의 상관 표본을 명시했다. 오류나 관측불가를 임의 성공으로 바꾸지 않았다.

실행법은 `../../tools/vision-check/EXPANSION_README.md`를 따른다. 소스 트리에서 uv run을 쓰는 보조 도구다. wheel 단독 설치 배포는 이번에 검증하지 않았다. ZIP의 대표 JPEG로 분석을 재실행하면 안 된다. 원래 PNG를 로컬 `/Users/rexxa/fls-astra-vision/report/expansion/raw`에서 사용하거나 기록된 커밋·저장·카메라로 다시 캡처한다.

전체 게임 tracked 소스·커밋·푸시는 변경하지 않았다. own 서버4470은 종료했다. DGX 실기 실행은 미검증이다.
