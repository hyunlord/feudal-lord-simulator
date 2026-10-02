# 출처

저장소: https://github.com/hyunlord/feudal-lord-simulator

가지: `codex/phase15-organic-ground`

검수 HEAD: `473abcbf47be03f4fb1dbcfe1717a847896c40f8`

- `docs/design/art-bible.md`: ART_BIBLE_v2, 남부 잉글랜드의 회갈색 잡석·갈색 참나무, 2:1 정사영 등각, 원본 스케일 계약.
- `public/assets/wall/stone_face_rubble_a-v2.png`: 실제 사용한 잡석 벽면.
- `public/assets/wall/stone_top_a-v1.png`: 실제 사용한 흉벽 및 상부 띠.
- `public/assets/wall/palisade_face_a-v2.png`: 실제 사용한 말뚝·가로 보강재.
- `public/assets/wall/palisade_top-v1.png`: 실제 사용한 윗줄.
- `public/assets/wave28/strip/dry_stone_wall_winter.png`: 눈 절단 원본.
- `references/`의 rubble_b, stone_top_b, palisade_face_b는 비교용 원본이며 최종 조각 제작에는 사용하지 않았다.
- `src/render/drawWallFaces.ts:88`: 벽면 slice의 시작·끝 범위. `:130` 전후 면/윗면의 법선·높이·텍스처 행렬. `:251` 모서리 모듈의 그리기 경로.
- `src/world/boundary/wallBaseline.ts`: 실제 벽 체인·위상·노드 구성.
- `scripts/renderCommitProbe.mjs:67`: Playwright 장면 열기와 카메라 주입.
- `tests/fixtures/boundary/seed2-arable-scene.json.gz`: 실제 저장 상태 배경. save codec으로 현 버전에 맞춰 읽음.

원본 이미지 SHA256과 저장소 경로 대응은 `records/source-hashes.json`. 원본 바이트를 직접 사용했으며 원본 PNG는 수정하지 않았다. 이전 `gate_corner_stone_*`, 목책 기둥 생성 그림은 최종 16종의 입력이 아니다. 생성 도구 호출 수는 0이다.
