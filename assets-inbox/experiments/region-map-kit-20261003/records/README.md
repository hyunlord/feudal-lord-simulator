# Charter & Kin · 인장과 가문 — 지역 지도 조립 키트

2026-10-03, **candidate / 게임 미설치**. PNG79개와 결정론 조립기, 1600×1000 JPEG16장을 제공한다. 자동 검증17건 통과. 눈가림 판별16/16(100%)로 목표70%이하에는 미달했다. 미술 채택 보류이며 남은 문제는 REVIEW.md와 BLIND.md에 기록했다.

## 열어 볼 순서

1. `proofs/SAMPLES-OVERVIEW.jpg`:16장 전체.
2. `proofs/KIT-OVERVIEW.jpg`:79개 키트.
3. `proofs/comparisons/`:각 지도와 원본 나란히 비교.
4. `REVIEW.md`, `BLIND.md`, `EXPANSION.md`.
5. `assembler/README.md`:입력 계약과 상세 명령.

## 실행

패키지 최상위에서 Node.js와 sharp를 사용한다. 이번 환경은 Node25.8.2, sharp0.34.5였다. 기존 sharp를 사용했고 의존성을 설치하지 않았다. 다른 환경에서는 설치된 sharp의 경로를 `MAPKIT_SHARP`로 지정하거나 Node의 기본 모듈 탐색으로 제공해야 한다. 패키지에 Node/sharp 바이너리는 포함하지 않는다.

```sh
node assembler/cli.cjs --seed 17 --archetype open_field --kit kit --out output/my-map
node assembler/cli.cjs --seed 83 --archetype forest_edge --estates estates.json --kit kit --out output/custom
node assembler/cli.cjs --seed 17 --archetype open_field --neighbor references/neighbor-world.json --kit kit --out output/neighbor
node assembler/test.cjs references/neighbor-world.json --render
```

땅 종류는 `open_field`(강가 기본), `coastal_port`(해안), `chalk_downs`(백악), `forest_edge`(숲), `fen_drainage`(습지). seed·영지 입력 순서·키트 바이트·렌더러 버전이 같으면 JPEG와 메타데이터가 같다. 기본12영지, 명시적 입력1–30개. 예:

```json
[{"id":"west","kind":"manor","x":330,"y":350},{"id":"east","kind":"abbey"}]
```

좌표는1600×1000 화면의 접지점(그림 하단 중앙). 양쪽 좌표를 생략하면 자동 배치한다. 잘못된 입력과 배치 불가능 상태를 오류로 반환한다.40영지·청크 연결·겨울은 이번 구현이 아닌 EXPANSION.md의 확장 설계다.

## 파일과 재료

| 폴더 | 내용 |
|---|---|
| kit | PNG79개, 종류·치수·피벗·겹침·알파·출처·SHA256 CSV/JSON |
| assembler | 실행 소스, 사용법, 자동 검증 기록 |
| samples | 5유형×seed17/83/241 + 이웃18영지, JPEG16개와 JSON |
| proofs | 전체 목록, 원본 비교16개, 눈가림 축소판16개 |
| references | 원본 지도 JPEG 비교용 파생본, 원본 이웃 JSON |
| provenance | 생성 프롬프트·출처·해시·QA·검수 기록 |

79개는 독립적으로 그린 원본79장이 아니다. 크기별 파생본, 프로젝트 기존 자산 재사용, 생성 그림, 연속 브러시 경로를 포함한다. 지형은 작은 건물 부품이 아닌 전체 덩어리다.73개 PNG는 실제 투명 RGBA, 종이와 지면6개는 바닥 채움용 불투명 RGBA다. 경로 PNG는 절차적 브러시 견본이며 물은 실제 생성 수로 그림을 휘어 연속 렌더한다. 그림 파일을 정사각형 타일로 맞붙이는 방식이 아니다.

기준 저장소 `hyunlord/feudal-lord-simulator`, 가지 `codex/phase15-organic-ground`, HEAD `a8834c7f31d83fed593b726d47f0fbd9108b91c3`. 복제본 `~/fls-astra-mapkit`는 읽기 전용으로 다뤘고 커밋·푸시·게임 코드 수정은 하지 않았다. 생성 큰 원본은 `~/fls-astra-mapkit-output/masters/`에만 남겼다. 출처의 절대 경로와 masters 경로는 제작 이력이며 ZIP 안에 해당 원본이 있다는 뜻은 아니다. 게임 런타임 성능·통행권·수문 시뮬레이션은 검증 범위 밖이다.

무결성은 `shasum -a 256 -c SHA256SUMS`로 확인한다.
