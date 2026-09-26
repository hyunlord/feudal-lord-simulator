# 2차 초상 풀 포장 재현

이 스크립트는 이미지 생성이나 시각 판정을 대신하지 않는다. 원본 PNG와 생성 기록을 검증하고 크기별 확인 그림·CSV·소지품 집계·파일 해시를 만든다. 실행 환경은 Node.js와 macOS AppKit 기반 `raster` 도구다.

## 입력

- `roster.json`: 32명 I069–I100. 성인 28명은 young/mature/old, 아이 4명은 child/young.
- `deliverable/portraits/<ID>_<stage>.png`: 불투명 256×256 PNG 92장.
- `generation-records/<ID>_<stage>.json`: `prompt`, `source_path`, `references` 포함. 참조 원본이 바뀌지 않도록 보존된 스냅숏 경로를 사용한다.
- 인물 또는 단계 속성에 `role`, `prop`, `prop_group`을 기록한다. `prop_group` 허용값은 `none`, `book_scroll`, `other`이다.
- 기본 참조 위치: `/tmp/astra-portrait-pivot-work/deliverable/portraits`와 `/tmp/astra-portrait-pool1-work/deliverable/portraits`. `POOL_PILOT`, `POOL_BATCH1` 환경 변수로 대체 가능하다.

## 실행

```sh
node /tmp/astra-portrait-pool2-work/package-pool2.mjs /tmp/astra-portrait-pool2-work
```

소지품 표는 단계 92장과 인물 32명 두 분모를 함께 표기한다. 인물 기준은 각 인물의 청년 단계다. 두루마리·책 25% 초과는 오류로 중단한다. 빈손 약 30%는 실제 비율을 표시하고 최종 검수자가 판정한다. CSV 집계와 실제 그림 판독은 별개의 증거로 유지한다.

`--blind-only`는 무작위 익명 의복 크롭과 정답표만 생성한다. `--manifest-only`는 검수 문서 추가 후 이미지 재생성 없이 `inventory.json`과 `SHA256SUMS`만 갱신한다.

## 확인 그림 재현

`provenance/proof-scenes/*.json`의 이미지 경로는 각 JSON 파일의 디렉터리에 상대적이다. 패키지를 다른 위치에 풀어도 그대로 렌더링할 수 있다. `raster.swift`를 macOS에서 컴파일한 뒤 다음과 같이 실행한다.

```sh
swiftc provenance/tools/raster.swift -o /tmp/pool2-raster
/tmp/pool2-raster board /tmp/proof-reproduced.png provenance/proof-scenes/01-all-92-256-and-96.json
```

네 개의 확인 그림 이름과 실제 크기는 장면 JSON을 따른다. 추가 비교 원본 68장은 승인된 파일럿 36장과 1차 청년 32장으로, 이번 납품 초상 92장과 구분한다.

## 최종 봉인

시각 검수와 CSV 내용 검수가 완료되면 `QA_REPORT.md`와 검수표를 기록한 뒤 `--manifest-only`를 실행한다. `SHA256SUMS`의 모든 파일을 검증하고, ZIP 작성 후 CRC 검사와 압축을 푼 파일 해시를 다시 대조한다. 기술 검증의 PASS는 인물 구별·노화 동일성·소지품 그림 판독의 PASS를 뜻하지 않는다.

독립 검증 스크립트는 이미지나 CSV를 수정하지 않는다. 보고서는 해시 목록에 자기 자신이 포함되는 순환을 피하기 위해 deliverable 밖에 쓴다.

```sh
node /tmp/astra-portrait-pool2-work/validate-package-pool2.mjs /tmp/astra-portrait-pool2-work/deliverable /tmp/astra-portrait-pool2-work/package-validation.json
```

PNG 헤더·CSV 왕복·ID/단계·소지품 집계·네 확인 그림의 이미지 좌표 범위·소지품 표와 초상 행의 간격·생성 기록과 참조·모든 파일 SHA256을 교차 검증한다. 텍스트는 시작점과 높이 범위를 검사하며 실제 글자 폭이나 이미지 미관은 시각 검수로 확인한다.

## 중간 시각 검수 격자

```sh
node /tmp/astra-portrait-pool2-work/make-review-grids.mjs /tmp/astra-portrait-pool2-work
```

청년 단계 32장을 모두 갖춘 뒤 실행하면 `review-grids/`에 256px·96px 청년32명, 1·2차 청년64명96px, 파일럿·2차68명96px 격자와 입력 해시 기록이 생긴다. 최종 `checks/`의 확인 그림 4장에는 추가하지 않는다. 누락 파일은 기본적으로 오류이며 `--allow-missing`을 명시하면 누락 칸과 INCOMPLETE 표식을 보인다.
