# 에셋 받은 편지함 (assets-inbox)

Astra가 만든 산출물은 **설치 여부와 관계없이** `assets-inbox/<wave>/`에 받은 바이트 그대로 보관하고, 모든 PNG의 판정 상태를 [`assets-inbox/INBOX_LEDGER.csv`](../assets-inbox/INBOX_LEDGER.csv) 한 장부에 적는다(AGENTS 상시 규칙 17). 설치는 여기서 꺼내 `public/assets/`로 옮기는 별도 작업이며, 설치 대장은 `docs/provenance/assets.csv`다. 이 폴더의 파일은 고치지 않는다.

## 1. 폴더 구조

```
assets-inbox/
  INBOX_LEDGER.csv          ← PNG 한 장당 한 행 (inbox PNG 수 = 장부 행 수)
  README.md                 ← Wave별 받은 곳과 설치 이력(초기 Wave)
  <wave>/
    <파일들>                 ← INBOX-1 이전에 받은 것(평평한 구조, 그대로 둠)
    provenance-*.csv        ← Astra가 보낸 대장(assets.csv)을 이름만 바꿔 둔 것
    <batch>/                ← INBOX-1부터: 받은 묶음 하나(ZIP 하나)
      assets/               ← 에셋 PNG(+ masters·templates·masks·retained·original-assets 등 하위 경로 유지)
      proofs/               ← 확인 그림(checks·proofs·contact·preview)
      records/              ← CSV·검수표·생성 기록·SHA256SUMS·index.html 등 (records 안의 PNG 포함)
      workdir-variant/      ← 같은 경로인데 작업 폴더(output/) 쪽 바이트가 ZIP과 다른 경우만
```

- `<batch>` 이름은 받은 ZIP의 이름에서 딴다: `candidates-v1`, `candidates-20260925`, `rework-v1`, `rework-20260926`, `plague-fix-20260926`, `pilot-20260924`, `production-20260924` 등. 재작업본은 원본과 **다른 묶음 폴더**에 들어가므로 이름이 같아도 겹치지 않는다.
- **이미 inbox에 있던 Wave**(d1·d1b·wave2·wave4-pilot·wave4b~4e·wave5a·wave5b)에는 **없는 파일만** 묶음 폴더로 더했다. 같은 바이트(또는 C2PA `caBX` 청크만 다른 바이트)가 Wave 안에 이미 있으면 넣지 않았다. 덮어쓴 파일은 없다.
- `ui-p0/`는 UX-2 브랜치(`claude/ux2-art-skin`, 본선 미병합)가 먼저 만든 구조(`ui/` 43 · `superseded/` 12 · `pilot/` 12 + `inbox-status.csv`·`provenance-ui-p0*.csv`)를 **같은 경로·같은 바이트**로 가져왔다. UX-2가 본선에 병합될 때 같은 파일끼리라 충돌하지 않는다. UI 파일럿은 UX-2와 맞춰 `ui-p0/pilot/`에 있고, 거기 없던 파일럿 확인 그림·기록은 `ui-p0/pilot-candidates-v1/`에 있다.
- C2PA `caBX` 청크가 붙은 PNG도 받은 바이트 그대로다. 설치할 때 청크를 빼면 Astra 대장 SHA와 같다(장부 `verdict_note`에 `C2PA caBX 포함` 표시).
- `assets-inbox/**/*.png`는 Git LFS다(`.gitattributes`). CSV·JSON·MD·HTML은 일반 파일이다.

## 2. 상태 뜻

| status | 뜻 |
|---|---|
| `candidate` | 받았지만 아직 판정하지 않음(또는 판정 기록을 찾지 못함) |
| `confirmed` | 채택 확정. 설치했으면 `installed_by`에 작업 ID |
| `rework_pending` | 재작업을 기다림. 재작업본이 오면 이 행은 `superseded`로 바꾸고 `replaced_by`를 채운다 |
| `superseded` | 재작업본·다음 판으로 대체됨. **지우지 않는다.** `replaced_by`가 대체본 경로 |
| `rejected` | 채택하지 않음(inbox에만 남김) |
| `retired` | 채택했다가 거둬들임(예: 역사 오류) |

장부 열: `wave, file(assets-inbox 기준 경로), sha256(받은 바이트), status, replaced_by, verdict_note, installed_by`. 대체본이 여러 장이면 `replaced_by`에 경로를 `;`로 잇는다.
확인 그림·기록 PNG도 한 행씩 있으며, 상태는 그 그림이 확인하는 묶음의 상태를 따른다(`verdict_note`에 `확인 그림`/`기록 그림`).

`installed_by`는 **바이트 증거가 있을 때만** 채웠다: 본선(93d0f32) `public/assets/`에 같은 바이트(또는 `caBX`를 뺀 바이트)가 있으면 그 Wave의 설치 작업 ID, UX-2 브랜치 `public/assets/`에만 있으면 `UX-2`(비고에 "본선 미병합"). INSTALL-5c·F0-V·INSTALL-7처럼 판정표상 설치 예정이지만 아직 어느 브랜치에서도 같은 바이트를 찾지 못한 것은 빈칸이고, 비고에 "설치 예정"이라고 적었다. 설치가 끝나면 그 작업이 이 칸을 채운다.

## 3. 현재 장부 요약 (2026-09-26 13시 갱신)

| wave | PNG | candidate | confirmed | rework_pending | superseded | rejected | retired | 설치 확인 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `asset-trial` | 23 | 23 |  |  |  |  |  | 0 |
| `d1` | 7 | 2 | 5 |  |  |  |  | 5 |
| `d1b` | 4 | 2 | 2 |  |  |  |  | 2 |
| `derived-templates` | 5 |  | 5 |  |  |  |  | 0 |
| `l1-tile` | 1 |  | 1 |  |  |  |  | 1 |
| `people-pilot1` | 33 |  | 21 |  |  | 12 |  | 0 |
| `portrait-pool` | 147 |  | 147 |  |  |  |  | 0 |
| `retired` | 13 |  |  |  |  |  | 13 | 0 |
| `ui-p0` | 85 |  | 56 |  | 29 |  |  | 43 |
| `walker-pilot2` | 96 |  | 96 |  |  |  |  | 0 |
| `wave10` | 735 |  |  |  |  | 735 |  | 0 |
| `wave11` | 69 |  | 69 |  |  |  |  | 55 |
| `wave12` | 89 |  | 65 |  | 24 |  |  | 0 |
| `wave13` | 118 |  | 118 |  |  |  |  | 0 |
| `wave14` | 147 |  | 146 |  | 1 |  |  | 0 |
| `wave15` | 69 |  | 69 |  |  |  |  | 0 |
| `wave16` | 49 |  | 49 |  |  |  |  | 0 |
| `wave17` | 64 |  | 64 |  |  |  |  | 0 |
| `wave19` | 57 | 57 |  |  |  |  |  | 0 |
| `wave2` | 42 | 15 | 27 |  |  |  |  | 27 |
| `wave3` | 98 |  | 88 |  | 10 |  |  | 0 |
| `wave4-pilot` | 15 | 3 | 12 |  |  |  |  | 12 |
| `wave4b` | 57 | 4 | 53 |  |  |  |  | 53 |
| `wave4c` | 29 | 11 | 18 |  |  |  |  | 18 |
| `wave4d` | 25 | 3 | 22 |  |  |  |  | 22 |
| `wave4e` | 53 | 18 | 35 |  |  |  |  | 35 |
| `wave5a` | 151 | 87 | 61 |  | 3 |  |  | 55 |
| `wave5b` | 36 | 4 |  |  |  | 32 |  | 0 |
| `wave5c` | 17 |  | 17 |  |  |  |  | 14 |
| `wave6` | 25 |  | 25 |  |  |  |  | 22 |
| `wave7` | 206 |  | 172 |  | 34 |  |  | 77 |
| `wave8` | 41 |  | 40 |  | 1 |  |  | 0 |
| `wave9` | 52 |  | 45 |  | 4 |  | 3 | 0 |
| `zone-ground-pilot` | 7 |  |  |  |  | 7 |  | 0 |
| **합계** | **2665** | **229** | **1528** | **0** | **106** | **786** | **16** | **441** |

## 4. 찾는 법

```sh
# 한 파일의 상태
grep ',wave7/candidates-v1/assets/overlay/boarded_l2-v1.png,' assets-inbox/INBOX_LEDGER.csv
# 재작업 대기 목록
awk -F, '$4=="rework_pending"{print $2}' assets-inbox/INBOX_LEDGER.csv
# 어떤 v1이 무엇으로 바뀌었나
awk -F, '$4=="superseded"{print $2" -> "$5}' assets-inbox/INBOX_LEDGER.csv
# SHA로 inbox 원본 찾기(설치된 파일의 출처 추적)
grep <sha256> assets-inbox/INBOX_LEDGER.csv
# PNG 실제 바이트 받기(클론 직후 LFS 포인터만 있을 때)
git lfs pull --include="assets-inbox/wave7/**"
```

## 5. INBOX-1에서 받은 곳 (2026-09-26 00:50 KST 기준)

찾은 경로: `/tmp/astra-*.zip` 30개(`/tmp`는 `/private/tmp`와 같은 곳), Astra 작업 폴더 `~/github/feudal-lord-simulator/output/astra-*` 13개, UX-2 브랜치 `assets-inbox/ui-p0`. `~/Downloads`의 `ASTRA_*_의뢰서.md`·`astra-*-reference-files.zip`·`astra-wave*-package.zip`은 Astra에 **보낸** 의뢰·참고 자료라 받지 않았다.

| 받은 곳 | 넣은 곳 | 크기 | SHA-256 | 추가 파일 | 이미 있어 건너뜀 | 제외(sources·references·.omx) |
|---|---|---:|---|---:|---:|---:|
| `/tmp/astra-D1-assets-20260924.zip` | `d1/assets-20260924` | 2,252 KB | `b063b9ffd6000404…` | 13 | 6 | 1 KB |
| `/tmp/astra-D1b-assets-20260924.zip` | `d1b/assets-20260924` | 1,276 KB | `6c6becff3dde64f5…` | 11 | 3 | 0 KB |
| `/tmp/astra-l1-tile-20260924.zip` | `l1-tile/tile-v1` | 29 KB | `86e555b235965397…` | 8 | 0 | 0 KB |
| `/tmp/astra-people-pilot-candidates-20260925.zip` | `people-pilot1/candidates-v1` | 22,256 KB | `a2760d5d79a2b5ff…` | 66 | 0 | 18,489 KB |
| `output/astra-people-pilot-v1/` (작업 폴더) | `people-pilot1/candidates-v1` | — | — | 0 | 0 | 18,489 KB |
| `/tmp/astra-ui-p0-candidates-20260925.zip` | `ui-p0/candidates-v1` | 54,337 KB | `1d593d3c1add9f3b…` | 45 | 44 | 49,732 KB |
| `output/astra-ui-p0-candidates-v1/` (작업 폴더) | `ui-p0/candidates-v1` | — | — | 0 | 0 | 49,732 KB |
| `/tmp/astra-ui-p0-rework-20260925.zip` | `ui-p0/rework-v1` | 24,566 KB | `5ea51cca0a71de07…` | 35 | 45 | 23,045 KB |
| `output/astra-ui-p0-rework-v1/` (작업 폴더) | `ui-p0/rework-v1` | — | — | 0 | 0 | 23,045 KB |
| `/tmp/astra-ui-pilot-candidates-20260925.zip` | `ui-pilot/candidates-v1` | 19,328 KB | `15f84bea5c12f88b…` | 40 | 12 | 16,989 KB |
| `output/astra-ui-pilot-candidates-v1/` (작업 폴더) | `ui-pilot/candidates-v1` | — | — | 0 | 0 | 16,989 KB |
| `/tmp/astra-walker-pilot2-candidates-20260925.zip` | `walker-pilot2/candidates-v1` | 17,586 KB | `76aca9baac176123…` | 139 | 0 | 12,762 KB |
| `output/astra-walker-pilot2-v1/` (작업 폴더) | `walker-pilot2/candidates-v1` | — | — | 0 | 0 | 12,762 KB |
| `/tmp/astra-wave10-candidates-20260925.zip` | `wave10/candidates-20260925` | 36,770 KB | `903e589bce880aad…` | 218 | 0 | 0 KB |
| `/tmp/astra-wave11-candidates-20260926.zip` | `wave11/candidates-v1` | 60,996 KB | `0c3e1ef80f15c127…` | 132 | 0 | 55,040 KB |
| `output/astra-wave11-candidates-v1/` (작업 폴더) | `wave11/candidates-v1` | — | — | 0 | 0 | 55,040 KB |
| `/tmp/astra-wave2-assets-20260924.zip` | `wave2/pilot-20260924` | 1,235 KB | `bfb55b021c097bec…` | 21 | 5 | 0 KB |
| `/tmp/astra-wave2-production-20260924.zip` | `wave2/production-20260924` | 3,652 KB | `78b31f1142794c4d…` | 23 | 35 | 0 KB |
| `/tmp/astra-wave3-candidates-20260926.zip` | `wave3/candidates-20260926` | 2,894 KB | `f5b59a9dd462abbf…` | 112 | 0 | 0 KB |
| `/tmp/astra-wave4-candidates-20260925.zip` | `wave4-pilot/candidates-20260925` | 2,080 KB | `09635afa8eebad32…` | 21 | 8 | 0 KB |
| `/tmp/astra-wave4b-candidates-20260925.zip` | `wave4b/candidates-20260925` | 10,637 KB | `5c2bd98e0fdc0fb3…` | 25 | 54 | 0 KB |
| `/tmp/astra-wave4c-candidates-20260925.zip` | `wave4c/candidates-v1` | 25,661 KB | `d7d4d6cdcfbd6fd9…` | 57 | 19 | 23,501 KB |
| `output/astra-wave4c-v1/` (작업 폴더) | `wave4c/candidates-v1` | — | — | 0 | 19 | 23,501 KB |
| `/tmp/astra-wave4d-candidates-20260925.zip` | `wave4d/candidates-20260925` | 3,808 KB | `3624075ca7bb2d91…` | 19 | 23 | 0 KB |
| `/tmp/astra-wave4e-candidates-20260925.zip` | `wave4e/candidates-v1` | 50,593 KB | `88596a82953f36d3…` | 79 | 36 | 39,879 KB |
| `output/astra-wave4e-candidates-v1/` (작업 폴더) | `wave4e/candidates-v1` | — | — | 0 | 36 | 39,879 KB |
| `/tmp/astra-wave5a-29sheets-candidates-20260925.zip` | `wave5a/candidates-v2-29sheets` | 48,606 KB | `b66fdffaf1acf01f…` | 135 | 56 | 37,137 KB |
| `output/astra-wave5a-candidates-v2/` (작업 폴더) | `wave5a/candidates-v2-29sheets` | — | — | 0 | 56 | 37,137 KB |
| `/tmp/astra-wave5a-candidates-20260925.zip` | `wave5a/candidates-v1` | 47,556 KB | `d92c65e8a9f3d380…` | 131 | 54 | 36,287 KB |
| `output/astra-wave5a-candidates-v1/` (작업 폴더) | `wave5a/candidates-v1` | — | — | 5 | 55 | 37,137 KB |
| `/tmp/astra-wave5b-candidates-20260925.zip` | `wave5b/candidates-20260925` | 3,392 KB | `9d61e75c520d7f64…` | 40 | 26 | 0 KB |
| `/tmp/astra-wave5c-candidates-20260925.zip` | `wave5c/candidates-20260925` | 6,205 KB | `7ae2b8e0b9e72864…` | 42 | 0 | 0 KB |
| `/tmp/astra-wave6-candidates-20260925.zip` | `wave6/candidates-20260925` | 1,034 KB | `b98c843526f00fa5…` | 50 | 0 | 0 KB |
| `/tmp/astra-wave7-candidates-20260925.zip` | `wave7/candidates-v1` | 78,661 KB | `951f63d93ad6fc30…` | 202 | 0 | 77,633 KB |
| `output/astra-wave7-candidates-v1/` (작업 폴더) | `wave7/candidates-v1` | — | — | 0 | 0 | 77,633 KB |
| `/tmp/astra-wave7-rework-20260926.zip` | `wave7/rework-v1` | 14,813 KB | `ec7528895dee5470…` | 156 | 0 | 12,765 KB |
| `output/astra-wave7-rework-v1/` (작업 폴더) | `wave7/rework-v1` | — | — | 0 | 0 | 12,765 KB |
| `/tmp/astra-wave8-candidates-20260925.zip` | `wave8/candidates-20260925` | 29,427 KB | `cb172351ebea4849…` | 69 | 0 | 0 KB |
| `/tmp/astra-wave8-plague-fix-20260926.zip` | `wave8/plague-fix-20260926` | 3,129 KB | `f6f506b1d6b4bcb6…` | 6 | 0 | 0 KB |
| `/tmp/astra-wave9-candidates-20260925.zip` | `wave9/candidates-20260925` | 3,298 KB | `f8c9e9aa82ffcb77…` | 60 | 0 | 126 KB |
| `/tmp/astra-wave9-rework-20260926.zip` | `wave9/rework-20260926` | 366 KB | `489e0cb2fbc48cab…` | 18 | 0 | 0 KB |
| `/tmp/astra-zone-ground-pilot-20260924.zip` | `zone-ground-pilot/pilot-20260924` | 29,932 KB | `9b542209159f99ee…` | 14 | 0 | 0 KB |
| `output/astra-asset-trial/` (작업 폴더) | `asset-trial/trial-v1` | — | — | 38 | 0 | 0 KB |

| `/tmp/astra-wave13-candidates-20260926.zip` (01:23) | `wave13/candidates-v1` | 33,601 KB | `98cb9c2c9cef5be4…` | 210 | 0 | `raw/`·`sources/`·`references/` 제외 |
| `output/astra-wave13-candidates-v1/` (작업 폴더) | `wave13/candidates-v1` | — | — | 0(ZIP과 같음) | — | 〃 |
| `/tmp/astra-wave3-fix-20260926.zip` (08:51) | `wave3/fix-20260926` | 431 KB | `419eef4dbd71bc6a…` | 24 | 0 | — |
| `/tmp/astra-wave10-v2-candidates-20260926.zip` (08:54) | `wave10/v2-candidates-20260926` | 51,798 KB | `88b8d267829791cb…` | 619 | 0 | `raw/`·`references/` 제외 |
| `/tmp/astra-wave12-candidates-20260926.zip` (09:02) | `wave12/candidates-20260926` | 6,754 KB | `95af6c36e96be40b…` | 73 | 0 | `raw/`·`references/` 제외 |
| `/tmp/astra-wave14-candidates-20260926.zip` (09:06) | `wave14/candidates-v1` | 49,858 KB | `e6b616aa5092f631…` | 164 | 0 | `raw/`·`references/` 제외 |
| `output/astra-wave14-candidates-v1/` (작업 폴더) | `wave14/candidates-v1` | — | — | 0(ZIP과 같음) | — | 〃 |
| `/tmp/astra-wave14-texture-rework-20260926.zip` (09:18) | `wave14/texture-rework-20260926` | 21,955 KB | `5cc3e46c9379956d…` | 64 | — | `raw/`·`references/` 제외 |
| `output/astra-wave14-texture-rework-v1/` (작업 폴더) | `wave14/texture-rework-20260926` | — | — | 0 | — | 〃 |
| `/tmp/astra-wave15-candidates-20260926.zip` (09:18) | `wave15/candidates-20260926` | 3,708 KB | `13bb93a9777f000e…` | 97 | — | `raw/`·`references/` 제외 |
| `/tmp/astra-wave12-rework-20260926.zip` (09:21) | `wave12/rework-20260926` | 3,910 KB | `a76f2f2d4fa78141…` | 59 | — | `raw/`·`references/` 제외 | 본체·아이콘·확정 오버레이 4장은 같은 바이트라 건너뜀
| `/tmp/astra-portrait-pivot-candidates-20260926.zip` (09:33) | `portrait-pool/pivot-pilot-20260926` | 99,866 KB | `8aad52a626f1b083…` | 114 | — | `raw/`·`references/` 제외 |
| `/tmp/astra-wave16-candidates-20260926.zip` (11:21) | `wave16/candidates-v1` | 210,345 KB | `9b879a87344a3b12…` | 97 | — | `raw/`(139MB)·`references/` 제외 |
| `output/astra-wave16-candidates-v1/` (작업 폴더) | `wave16/candidates-v1` | — | — | 0 | — | 〃 |
| `/tmp/astra-portrait-pool1-candidates-20260926.zip` (11:57) | `portrait-pool/pool1-20260926` | 236,415 KB | `854e28b69fc28751…` | 210 | 37(승인된 파일럿 초상 사본 36 등) | `raw/`·`references/` 제외 |
| `/tmp/astra-wave17-candidates-20260926.zip` (11:49) | `wave17/candidates-20260926` | 37,001 KB | `40c4963d35feb765…` | 157 | 0 | `raw/`·`references/` 제외 |
| `/tmp/astra-wave19-candidates-20260926.zip` (22:18, UI-4b가 받음 2026-09-27) | `wave19/candidates-20260926` | 67,936 KB | `67a53685d4ad8ee4…` | 86 | 0 | `raw/`(60MB)·`references/`·`scripts/` 제외 |
- **제외한 것**: 각 묶음의 `sources/`(모델이 낸 원시 생성본·중간 크기본)와 `references/`(Astra에 보낸 입력), `.omx/`(작업 도구 상태). 합계 약 826MB로, 받은 PNG 전체(약 200MB)의 4배라 inbox에 넣지 않았다. 새 묶음의 `raw/`(실제 생성 결과, Wave 13부터 이 이름)도 같은 이유로 넣지 않는다. 이것들은 저장소에 넣지 않는다(2026-09-26 결정). 대신 **원본 ZIP과 작업 폴더 전체를 저장소 밖 `~/feudal-lord-analysis/astra-raw/{zips,output}/`에 복사해** `/tmp`가 지워져도 남게 한다(ZIP은 SHA로, 폴더는 `diff -r`로 확인).
- 작업 폴더(`output/astra-*`)는 ZIP과 같은 묶음 폴더로 합쳤다. 같은 경로·같은 바이트는 한 번만, 같은 경로·다른 바이트는 `workdir-variant/` 아래에 두었다.

## 6. 판정표와 다른 점·확인이 필요한 것

- **Wave 9**: confirmed 33이 맞다(판정표 34는 오기, 2026-09-26 확인).
- **UI 파일럿**: 12장 모두 `superseded`. `icon_status_sheet`는 P0 `icon_prediction_sheet`·`icon_alert_priority_sheet`·`icon_lock_new_sheet` 세 장으로 대체(2026-09-26 판정). `cursor_sheet` → P0 커서 6장 대응은 추정.
- **Wave 10(이전 판정 기록, 지금은 전부 rejected)**: '머리 17'은 헤어 18종(`pt_hair_f_01~09`, `pt_hair_m_01~09`, 각각 앞·`_rear`) 중 `m_06`을 뺀 17종으로 읽었다. `pt_hair_m_06`(+`_rear`)은 `rework_pending`이다. 마스크·`records/provenance/raw`는 해당 레이어의 상태를 따르고, `pilot-reuse/` 4장은 `rework_pending`(2026-09-26 판정).
- **Wave 5a**: `candidates-v1`(26장 시트)과 `candidates-v2-29sheets` 45장 중 42장이 같은 바이트여서 `candidate`, 다른 3장만 `superseded`(→ v2)다. 판정표에 Wave 5a가 없어 v2 masters도 `candidate`다.
- **판정표에 없는 묶음**: `l1-tile`(본선 설치 확인 → `confirmed`, 설치 커밋 622e588), `asset-trial`, 기존 Wave에 새로 더한 확인 그림 → `candidate`. `zone-ground-pilot` 7장은 `rejected`(2026-09-26 판정).
- **Wave 11**: 공사 키트 55장 `confirmed`(확인 그림·기록 그림 포함 69행).
- **Wave 13**: 수레·가축 34장 `confirmed`(확인 그림·기록 그림 포함 118행).
- **Wave 12**: 본체 29·아이콘 시트 3·가동 오버레이 28 전부 확정. 오버레이 24장은 재작업본(`wave12/rework-20260926/`)이 `confirmed`이고 옛 24장은 `superseded`. `charcoal_clamp`·`lime_kiln`·`pottery_kiln`·`communal_oven`은 처음 판이 그대로 `confirmed`. 시설별 발판 크기 `buildings.csv`는 `records/`에 있다.
- **Wave 14**: 원본 71장 중 70장 `confirmed`, `heraldry/shield_surface_texture.png`는 `superseded`(→ 질감 재작업 `shield_surface_texture_multiply`·`_screen`). 질감 재작업 4장(`multiply`·`screen`·`merchant_ink_stamp_texture`·`merchant_carved_texture`) `confirmed`.
- **Wave 10**: 초상 방식을 레이어 합성에서 완성 초상 풀로 바꿔 v1·v2의 레이어·마스크·파생 레이어·합성본·확인 그림 735행 전부 `rejected`(비고 "방식 전환: 레이어 합성 → 완성 초상 풀", 이전 상태 병기). 인물 파일럿 1의 초상 6장은 `confirmed` 그대로.
- **Wave 5b 초상 레이어**: `B/layers/` 12장과 그 확인 그림 `B/checks/` 4장 `rejected`(방식 전환: 레이어 합성 → 완성 초상 풀). `A/` 아이·노인 자유 생성 워커 3장은 원래대로 `rejected`, `reused/held_staff_*` 4장은 재사용 소품으로 `candidate`, `derived-templates/`는 그대로.
- **초상 풀(`portrait-pool/`)**: 방식 전환 파일럿(`pivot-pilot-20260926`)이 첫 묶음. 완성 초상 P01~P36 36장과 노화 사슬 12장 `confirmed`. 원시 생성본 `provenance/raw`는 넣지 않았다. 1차 풀(`pool1-20260926`) 92장 `confirmed`(12시). 1차 ZIP의 `provenance/approved-pilot` 36장은 파일럿 초상과 같은 바이트라 다시 넣지 않았다.
- **Wave 15**: 계절 자연 65장 `confirmed`.
- **Wave 17**: 57장 `confirmed`(13시 판정). 그중 `animal_walk/ox-v1`·`cart/ox_cart_body-v1`은 Wave 13의 같은 이름 파일과 SHA가 같아 중복으로 보고 `wave17/`에서 빼고 Wave 13 행 비고에 표시했다(inbox에는 55장). `wall/stone_wall_repair_scaffold`는 비고 "설치 시 석벽 v2 옆에서 톤 확인". 확인·기록 그림 9장도 `confirmed`.
- **Wave 16**: 11:21 도착. 에셋 35장 `confirmed`(13시 판정), 확인 그림 11·기록 그림 3도 `confirmed`(비고에 표시).
- **Wave 3**: 재작업본 10장 `confirmed`, 해당 v1 10장 `superseded`(→ `wave3/fix-20260926/assets/…`). Wave 3 에셋 82장 확정.

## 7. 찾지 못한 것

| 항목 | 상태 |
|---|---|
| 채팅 첨부로만 받은 파일 | 이 Mac의 파일 시스템에서 찾을 수 없음. 위 목록에 없는 ZIP이 있으면 추가로 받아야 함 |

## 8. 이후 규칙

- Astra 산출물은 도착하면 설치 여부와 관계없이 `assets-inbox/<wave>/<batch>/`에 보관하고 `INBOX_LEDGER.csv`에 행을 더한다. 판정이 오기 전에는 모두 `candidate`다. `sources/`·`raw/`·`references/`는 넣지 않는다.
- 같은 때 원본 ZIP과 `output/astra-*` 작업 폴더를 `~/feudal-lord-analysis/astra-raw/{zips,output}/`에 복사한다(저장소 밖, 재부팅 대비).
- 재작업본이 오면 원본 행은 `superseded` + `replaced_by`, 재작업본은 판정 전까지 `candidate`.
- 장부는 여러 세션이 고친다. 다시 생성하지 말고 해당 행만 고치거나 행을 더한다.
- 판정·재작업·설치가 바뀌면 장부 행의 `status`·`replaced_by`·`installed_by`만 고친다. 파일은 지우거나 덮어쓰지 않는다.
- 장부 행 수 = inbox PNG 수를 유지한다.
