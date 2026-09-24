# AI 생성 에셋 기록 규칙 (Astra 작업용)

작성 2026-09-23 · 근거: Steam Content Survey의 "사전 생성 AI 콘텐츠" 공개 요건, 플랫폼 딥리서치

## 왜 필요한가

이 게임의 이미지는 GPT 계열 생성 도구로 만들어 최종 게임에 들어간다. Steam은 이런 게임에 **스토어·빌드 심사 제출 전 AI 사용 공개**를 요구하고, 개발자가 불법·권리 침해 콘텐츠가 없다는 책임을 진다. Valve가 프롬프트 보존 기간을 정해 두지는 않았지만, 출시 직전에 "이건 어떻게 만들었지?"를 역추적하는 것보다 **만들 때 한 줄 남기는 게** 훨씬 싸다. 권리 분쟁이 생겼을 때도 이 기록이 방어 자료가 된다.

## 원칙

1. **게임에 들어가는 파일(런타임 에셋)은 전부 기록이 있어야 한다.** 후보·반려본은 선택.
2. 생성할 때 바로 남긴다. 나중에 몰아서 쓰지 않는다.
3. 도구가 주지 않은 정보(seed, 모델 버전)는 **지어내지 않는다.** 모르면 빈칸 또는 `unknown`.
4. 참조 이미지는 **프로젝트 자체 이미지만**. 외부 작품(루리웹 영감 연작, 상용 게임 캡처, 타인의 그림)을 생성 입력으로 넣지 않는다. 넣었다면 반드시 기록하고 그 에셋은 교체 대상으로 표시한다.
5. 수작업 수정(잘라내기, 색 보정, 합성, 축소)도 기록한다. 원본 → 최종의 관계가 보여야 한다.

## 필드

| 필드 | 필수 | 설명 | 예 |
|---|---|---|---|
| `assetId` | ✓ | 런타임 에셋 ID(파일 ID와 동일) | `house_l2` |
| `version` | ✓ | 에셋 버전 | `v2` |
| `runtimePath` | ✓ | 게임이 읽는 파일 경로 | `public/assets/buildings/historical-houses/house_l2-v2.png` |
| `runtimeSha256` | ✓ | 런타임 파일 해시 | |
| `sourcePath` | ✓ | 보관 원본 경로 | `docs/asset-evidence/runtime-sources/house_l2-v2.png` |
| `sourceSha256` | ✓ | 원본 해시 | |
| `tool` | ✓ | 생성 도구 이름 | `GPT Astra` |
| `model` | | 도구가 표시한 모델명·버전. 모르면 `unknown` | |
| `generatedAt` | ✓ | 생성일 (YYYY-MM-DD) | `2026-09-19` |
| `prompt` | ✓ | 실제로 넣은 최종 프롬프트 전체 (요약 금지) | |
| `referenceInputs` | ✓ | 입력한 참조 이미지 목록과 권리. 없으면 `none` | `house_l1-v2.png (project-own)` |
| `seed` | | 도구가 제공한 경우만 | |
| `candidates` | | 같은 요청에서 나온 후보 수, 반려 사유 | `4개 중 2번 선택, 1·3·4는 굴뚝 생성` |
| `manualEdits` | ✓ | 사람이 한 수정. 없으면 `none` | `알파 여백 자르기, 1254→256 축소` |
| `artBible` | ✓ | 적용한 아트 기준 | `AB_2026-09-19_v1` |
| `historicalProfile` | ✓ | 고증 프로필 | `S_England_1300_1450_v1` |
| `owner` | ✓ | 담당(사람 이름 또는 역할) | |
| `usedIn` | ✓ | 게임 안 사용 위치 | `주택 L2 1×1` |
| `status` | ✓ | `runtime` / `candidate` / `retired` / `needs-replacement` | |
| `notes` | | 권리 관련 메모 등 | |

## 저장 형식

저장소에 `docs/provenance/assets.csv` 한 파일(에셋당 한 행). 프롬프트가 길면 `docs/provenance/prompts/<assetId>-<version>.txt`로 빼고 CSV에는 경로만.

템플릿: `assets.template.csv`

## 이미 만든 에셋

지금까지 설치된 에셋은 기억과 남아 있는 프롬프트 파일(`output/*-prompt.txt`, 아트 방향 문서의 프롬프트)로 **할 수 있는 만큼** 역추적한다. 모르는 칸은 `unknown`, `status`는 그대로 `runtime`. 권리가 불확실한 참조를 썼던 에셋은 `needs-replacement`.

## Steam 제출 때 쓰는 방식 (참고)

Content Survey에는 대략 "게임의 건물·지형·소품 이미지 일부 또는 전부를 이미지 생성 도구로 만들었고, 프로젝트 자체 참조만 사용했으며, 사람이 선별·수정했다"는 식의 설명이 들어간다. 정확한 문항과 작성법은 제출 시점의 Steamworks 문서를 확인한다.
