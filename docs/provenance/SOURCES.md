# 에셋 생성 기록 역추적 — 훑은 원천

작성 2026-09-24. 이 Mac의 기록을 **읽기만** 해서 `assets.csv`를 채웠다. 원천 파일은 수정·이동·삭제하지 않았고, ZIP은 임시 폴더에 풀어 읽었다. 저장소에는 에셋 프롬프트(`prompts/`)와 매칭 근거(`evidence.json`: 경로·줄 번호·포인터·해시)만 넣었다. 세션 로그 원문은 커밋하지 않았다.

"항목 수"는 그 원천이 `evidence.json`에서 근거로 쓰인 런타임 에셋 행 수다(확실·강함 값만 셈).

## 읽음 — 근거로 쓰임

| 원천 | 크기 | 에셋 관련 항목 | 무엇을 줬나 |
|---|---|---|---|
| orca Codex 계정 홈 `~/Library/Application Support/orca/codex-accounts/*/home/sessions/**` (5개 홈) | 약 134 GB | 109 | `image_gen.generation` 이벤트 272건(고유). 이벤트마다 생성 PNG 전체(base64)가 있어 **SHA-256으로 원본과 직접 매칭**, `revisedPrompt`, 요청 시각, 요청의 참조 이미지, PNG 내부 C2PA(`softwareAgent`, OpenAI Media Service) |
| 〃 `generated_images/` (54be5844 홈) | 414 MB, 271개 | (위와 같은 파일) | 생성 원본 파일. 해시가 이벤트 결과와 같음 |
| `~/github/feudal-lord-simulator/output/game-art-complete-v1/records/*.json` | 71개 | 44 | 에셋별 `prompt_exact`, 생성일, 참조, 아트 기준·고증 프로필, `crop_or_edit` |
| `~/github/feudal-lord-simulator/output/medieval-art-batch-v1/records`, `manifest.json` | 44 레코드 | 22 | 같은 형식(시설 v2, 합필 주택) |
| `output/placement-art-v1`, `layered-farm-v1`, `farm-polish-v3`, `housing-historical-v2` 레코드 | 32 레코드 | 10+ | 같은 형식 |
| `output/runtime-art-simulation-v1/evidence/icons-install.json` | 1 | 8 | 아이콘 8개: 원본 해시 → 설치 해시, 처리 방식 |
| `output/medieval-city-direction/README.md`, `output/medieval-building-kit-v1/README.md` | — | 25 | 참조 계보(아래 "외부 참조 계보") |
| 저장소 `docs/asset-evidence/runtime-sources/derivatives.json`, `accepted-art/integration.json`, `phase16-sources/generation.json`, `public/assets/phase16-house-condition/registration.json`, `public/assets/world_asset_manifest.json` | — | 153 | 원본↔런타임 해시, 축소·합성 처리, seed/candidate |
| git 이력 `~/github/feudal-lord-simulator` (전 브랜치 486커밋) | — | 8 | 설치 커밋 시점의 생성 스크립트(`generateWorldAssets.py`, `generateUiAssets.py`). seed 공식이 기록된 seed를 그대로 재현하는지 확인 후 프롬프트·체크포인트·참조 경로 사용 |
| 저장소 `src/**` | — | 153 | `usedIn`(런타임 파일을 참조하는 소스) |

## 읽음 — 근거로 쓰이지 않음

| 원천 | 크기·항목 | 결과 |
|---|---|---|
| `~/.codex/sessions`, `~/.codex/archived_sessions` | 52 GB, 이 프로젝트 cwd 세션 936개 | 이미지 생성 이벤트 1건(런타임 에셋과 무관한 파일). SDXL 에셋 seed가 나오는 세션은 전체 홈에서 349개(이 홈 57개)지만 매니페스트·테스트 diff뿐, ComfyUI 작업 원문(프롬프트)은 없음 |
| `~/.codex/history.jsonl`, `~/.codex/generated_images` | 4 KB, 1개 | 에셋과 무관 |
| `~/.claude/projects/**` | 571 MB | `image_gen` 언급 2파일, 생성 기록 없음(Claude Code는 이미지를 생성하지 않음) |
| `~/github/feudal-lord-simulator/output/**/*-prompt.txt` | 81개 | 해당 에셋은 모두 세션 이벤트(해시 일치)로 확실 근거가 있어 사이드카 파일은 인용하지 않음. 내용 대조는 하지 않았음 |
| `~/github/feudal-lord-simulator/exports/feudal-medieval-research-{claude,originals}.zip` | 1,507 / 2,801 파일 | `04_PROMPT_HISTORY.md`, `image_manifest.json`, 원본 사본. 해시 색인에는 포함했으나 모두 위 원천의 사본 |
| `/tmp/feudal-lord-fable-2026-09-21.zip`, `/tmp/feudal-lord-simulator-results-20260922-160130.zip` | 925 / 2,346 파일 | `03_PROVENANCE.md`, Phase 8 ComfyUI 작업 JSON(현재 런타임과 다른 옛 수목) |
| `~/github/feudal-lord-simulator-playable/{output,.omo}` | — | Phase 8 raw-comfy(현재 런타임에 없음) |
| `~/Downloads` ZIP 전부(이름 검사), `master-2026-09-23.zip`, `ui-deep-research.zip`, `medieval-deep-research.zip`, `claude - Feudal Lord Simulator — *.md` | — | 규칙·설계 문서. 생성 기록 없음 |
| `~/Desktop` | 스크린샷 6개 | 무관 |

## 찾지 못한 원천

- **ChatGPT 내보내기**(`conversations.json`): 이 Mac에 없음. 확인된 생성은 모두 Codex 내장 `image_gen` 또는 DGX의 ComfyUI였으므로 대장 채우기에 필요하지 않았다.
- **DGX Spark 호스트의 ComfyUI 출력과 작업 이력**: Phase 4~13 SDXL 에셋의 원본 PNG, 실행 일시, 후처리 기록, Phase 13 round-1(seed 713000xx) 생성 스크립트가 이 Mac에 없다.
- **Codex 실행 변수**: 일부 요청은 참조 이미지를 `store()`한 변수로 넘겼다. 변수 값은 로그에 남지 않는다.

## 외부 참조 계보 (직접 참조 0건, 간접 25건)

`output/medieval-city-direction/01-settlement.png`(아트 방향 콘셉트)는 `references/caesar3-city.jpg`(README: Caesar III 스크린샷, dedoimedo.com)와 `references/town-evolution.png`(README: clien.net 게시물의 이용자 이미지)를 참조 입력으로 생성됐다(세션 요청 줄 497). 이후 02·03·04 단계는 01을 구도 기준으로 썼고, `medieval-building-kit-v1/01-timber-house.png`는 04를 스타일 기준으로 썼다.

런타임 에셋 153개 중 **외부 이미지를 직접 참조로 넣은 것은 없다.** 다만 25개는 참조 이미지를 거슬러 올라가면 이 두 외부 이미지에 닿는다(3단계 이상 거슬러 올라감). 규칙은 직접 참조만 `needs-replacement`로 정하므로 `status`는 `runtime`으로 두고 `notes`와 `evidence.json`(`field: "lineage"`)에 계보를 적었다. 교체 여부는 소유자 결정 사항이다.
