# 에셋 받은 편지함 (assets-inbox)

Astra가 만든 산출물은 **설치 여부와 관계없이** `assets-inbox/<wave>/`에 받은 바이트 그대로 보관하고, 모든 PNG의 판정 상태를 [`assets-inbox/INBOX_LEDGER.csv`](../assets-inbox/INBOX_LEDGER.csv) 한 장부에 적는다(AGENTS 상시 규칙 17). 설치는 여기서 꺼내 `public/assets/`로 옮기는 별도 작업이며, 설치 대장은 `docs/provenance/assets.csv`다. 이 폴더의 파일은 고치지 않는다.

## 1. 폴더 구조

```
assets-inbox/
  INBOX_LEDGER.csv          ← 그림(PNG·JPG) 한 장당 한 행 (inbox 그림 수 = 장부 행 수)
  README.md                 ← Wave별 받은 곳과 설치 이력(초기 Wave)
  <wave>/
    <파일들>                 ← INBOX-1 이전에 받은 것(평평한 구조, 그대로 둠)
    provenance-*.csv        ← Astra가 보낸 대장(assets.csv)을 이름만 바꿔 둔 것
    <batch>/                ← INBOX-1부터: 받은 묶음 하나(ZIP 하나)
      assets/               ← 에셋 PNG(+ masters·templates·masks·retained·original-assets 등 하위 경로 유지)
      proofs/               ← 확인 그림(checks·proofs·contact·preview)
      records/              ← CSV·검수표·생성 기록·SHA256SUMS·index.html 등 (records 안의 PNG 포함)
                              256KB를 넘는 기계 기록은 `<파일 이름>.astra-raw.txt` 안내 한 줄만(8절)
      workdir-variant/      ← 같은 경로인데 작업 폴더(output/) 쪽 바이트가 ZIP과 다른 경우만
```

- `<batch>` 이름은 받은 ZIP의 이름에서 딴다: `candidates-v1`, `candidates-20260925`, `rework-v1`, `rework-20260926`, `plague-fix-20260926`, `pilot-20260924`, `production-20260924` 등. 재작업본은 원본과 **다른 묶음 폴더**에 들어가므로 이름이 같아도 겹치지 않는다.
- **이미 inbox에 있던 Wave**(d1·d1b·wave2·wave4-pilot·wave4b~4e·wave5a·wave5b)에는 **없는 파일만** 묶음 폴더로 더했다. 같은 바이트(또는 C2PA `caBX` 청크만 다른 바이트)가 Wave 안에 이미 있으면 넣지 않았다. 덮어쓴 파일은 없다.
- `ui-p0/`는 UX-2 브랜치(`claude/ux2-art-skin`, 본선 미병합)가 먼저 만든 구조(`ui/` 43 · `superseded/` 12 · `pilot/` 12 + `inbox-status.csv`·`provenance-ui-p0*.csv`)를 **같은 경로·같은 바이트**로 가져왔다. UX-2가 본선에 병합될 때 같은 파일끼리라 충돌하지 않는다. UI 파일럿은 UX-2와 맞춰 `ui-p0/pilot/`에 있고, 거기 없던 파일럿 확인 그림·기록은 `ui-p0/pilot-candidates-v1/`에 있다.
- C2PA `caBX` 청크가 붙은 PNG도 받은 바이트 그대로다. 설치할 때 청크를 빼면 Astra 대장 SHA와 같다(장부 `verdict_note`에 `C2PA caBX 포함` 표시).
- `assets-inbox/**/*.png`는 Git LFS다(`.gitattributes`). CSV·JSON·MD·HTML과 JPG(Wave 24 앱 아이콘 16KB 한 장)는 일반 파일이다.

## 2. 상태 뜻

| status | 뜻 |
|---|---|
| `candidate` | 받았지만 아직 판정하지 않음(또는 판정 기록을 찾지 못함) |
| `confirmed` | 채택 확정. 설치했으면 `installed_by`에 작업 ID |
| `rework_pending` | 재작업을 기다림. 재작업본이 오면 이 행은 `superseded`로 바꾸고 `replaced_by`를 채운다 |
| `superseded` | 재작업본·다음 판으로 대체됨. **지우지 않는다.** `replaced_by`가 대체본 경로 |
| `rejected` | 채택하지 않음(inbox에만 남김) |
| `retired` | 채택했다가 거둬들임(예: 역사 오류) |

장부 열: `wave, file(assets-inbox 기준 경로), sha256(받은 바이트), status, replaced_by, verdict_note, installed_by`. 대체본이 여러 장이면 `replaced_by`에 경로를 `;`로 잇는다. `replaced_by`의 경로는 모두 장부의 다른 행이어야 하고, 병합 전 검사(`scripts/checks/inboxLedger.mjs`, AGENTS.md 규칙 19)가 아니면 본선 푸시를 거부한다. 같은 바이트가 두 행 이상이면 하나를 정본으로 두고 나머지 행 비고에 `○○와 동일 바이트(정본: 경로)`를 단다. 정본 선택 순서: ① runtime manifest(`src/**`·`public/**`의 `.ts`·`.json`이 `assets-inbox/…` 경로로 가리키는 것)나 설치 대장(`docs/provenance/assets.csv`의 `sourcePath`)이 가리키는 행. 가리켜지는 행이 둘 이상이면 사용자 판정(pivot-pilot `aging/P0x_young` ↔ `portraits/P0x`는 `portraits/`). ② 그다음은 confirmed 중 가장 먼저 받은 행(받은 때 = 5절 원본 ZIP·작업 폴더의 시각, 묶음 폴더 밖 행은 같은 Wave의 가장 이른 원본 시각; 같으면 처음 커밋한 때 → `assets/` > 묶음 맨 위 > `proofs/` > `records/` → 경로가 얕은 것 → 경로 순)이고, confirmed가 없는 묶음은 상태와 관계없이 가장 먼저 받은 행이다. 새로 들어오는 행이 기존 행과 바이트가 같은데 이 표시가 없으면 같은 검사가 푸시를 거부한다.
확인 그림·기록 PNG도 한 행씩 있으며, 상태는 그 그림이 확인하는 묶음의 상태를 따른다(`verdict_note`에 `확인 그림`/`기록 그림`).

`installed_by`는 **바이트 증거가 있을 때만** 채웠다: 본선(93d0f32) `public/assets/`에 같은 바이트(또는 `caBX`를 뺀 바이트)가 있으면 그 Wave의 설치 작업 ID, UX-2 브랜치 `public/assets/`에만 있으면 `UX-2`(비고에 "본선 미병합"). INSTALL-5c·F0-V·INSTALL-7처럼 판정표상 설치 예정이지만 아직 어느 브랜치에서도 같은 바이트를 찾지 못한 것은 빈칸이고, 비고에 "설치 예정"이라고 적었다. 설치가 끝나면 그 작업이 이 칸을 채운다.

## 3. 현재 장부 요약 (2026-10-02 10시 갱신)

| wave | 그림 | candidate | confirmed | rework_pending | superseded | rejected | retired | 설치 확인 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `asset-trial` | 23 |  | 2 |  |  | 21 |  | 0 |
| `d1` | 7 |  | 7 |  |  |  |  | 5 |
| `d1b` | 4 |  | 4 |  |  |  |  | 2 |
| `derived-templates` | 5 |  | 5 |  |  |  |  | 0 |
| `endings-manors` | 12 |  | 11 |  | 1 |  |  | 6 |
| `experiments` | 78 |  | 54 |  |  | 24 |  | 0 |
| `l1-tile` | 1 |  | 1 |  |  |  |  | 1 |
| `lineage` | 374 |  | 333 |  | 41 |  |  | 260 |
| `lineage-pilot` | 117 |  | 79 |  | 30 | 8 |  | 66 |
| `lord-components` | 43 |  | 43 |  |  |  |  | 0 |
| `people-pilot1` | 33 |  | 21 |  |  | 12 |  | 0 |
| `portrait-pool` | 340 |  | 340 |  |  |  |  | 304 |
| `retired` | 29 |  |  |  |  |  | 29 | 16 |
| `ui-p0` | 85 |  | 56 |  | 29 |  |  | 43 |
| `walker-pilot2` | 96 |  | 96 |  |  |  |  | 0 |
| `wave10` | 735 |  |  |  |  | 735 |  | 0 |
| `wave11` | 69 |  | 69 |  |  |  |  | 55 |
| `wave12` | 89 |  | 64 |  | 25 |  |  | 3 |
| `wave13` | 118 |  | 118 |  |  |  |  | 0 |
| `wave14` | 147 |  | 145 |  | 2 |  |  | 58 |
| `wave15` | 69 |  | 69 |  |  |  |  | 65 |
| `wave16` | 49 |  | 49 |  |  |  |  | 35 |
| `wave17` | 64 |  | 64 |  |  |  |  | 27 |
| `wave18` | 48 |  | 48 |  |  |  |  | 0 |
| `wave19` | 57 |  | 56 |  | 1 |  |  | 53 |
| `wave2` | 42 |  | 36 |  | 1 | 1 | 4 | 30 |
| `wave20` | 97 |  | 82 |  | 15 |  |  | 0 |
| `wave21` | 90 |  | 66 |  | 24 |  |  | 58 |
| `wave22` | 103 |  | 87 |  | 16 |  |  | 79 |
| `wave23` | 120 |  | 119 |  | 1 |  |  | 82 |
| `wave24` | 32 |  | 28 |  | 4 |  |  | 0 |
| `wave25` | 17 |  | 17 |  |  |  |  | 16 |
| `wave26` | 103 |  | 103 |  |  |  |  | 100 |
| `wave27` | 43 |  | 43 |  |  |  |  | 40 |
| `wave28` | 50 |  | 50 |  |  |  |  | 39 |
| `wave29` | 32 |  | 32 |  |  |  |  | 14 |
| `wave3` | 98 |  | 88 |  | 10 |  |  | 62 |
| `wave30` | 141 |  | 141 |  |  |  |  | 90 |
| `wave31` | 4 |  | 4 |  |  |  |  | 3 |
| `wave32` | 41 |  | 39 |  | 2 |  |  | 26 |
| `wave33` | 6 |  | 6 |  |  |  |  | 5 |
| `wave34` | 33 |  | 31 |  | 2 |  |  | 28 |
| `wave35` | 57 |  | 57 |  |  |  |  | 0 |
| `wave37` | 71 |  | 63 |  | 4 | 4 |  | 0 |
| `wave38` | 49 |  | 44 |  | 5 |  |  | 0 |
| `wave39` | 61 |  | 61 |  |  |  |  | 0 |
| `wave40` | 15 |  | 15 |  |  |  |  | 0 |
| `wave4-pilot` | 15 |  | 8 |  | 4 | 3 |  | 12 |
| `wave41` | 56 |  | 56 |  |  |  |  | 0 |
| `wave4b` | 57 |  | 43 |  | 14 |  |  | 53 |
| `wave4c` | 29 |  | 26 |  | 3 |  |  | 18 |
| `wave4d` | 25 |  | 24 |  | 1 |  |  | 22 |
| `wave4e` | 53 |  | 41 |  | 9 | 3 |  | 35 |
| `wave5a` | 151 |  | 61 |  | 3 | 87 |  | 55 |
| `wave5b` | 36 |  |  |  | 4 | 32 |  | 0 |
| `wave5c` | 17 |  | 17 |  |  |  |  | 14 |
| `wave6` | 25 |  | 25 |  |  |  |  | 22 |
| `wave7` | 206 |  | 168 |  | 38 |  |  | 77 |
| `wave8` | 41 |  | 39 |  | 2 |  |  | 37 |
| `wave9` | 52 |  | 44 |  | 5 |  | 3 | 41 |
| `zone-ground-pilot` | 7 |  |  |  |  | 7 |  | 0 |
| **합계** | **4767** | **0** | **3498** | **0** | **296** | **937** | **36** | **2057** |

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
| `/tmp/astra-portrait-pool2-candidates-20260926.zip` (09-26 13:43) | `portrait-pool/pool2-20260926` | 273,153 KB | `880757c350d77145…` | 240 | — | `raw/`·`generated/`·`references/` 제외 | approved-pilot 36·batch1 32는 같은 바이트라 건너뜀
| `/tmp/astra-wave18-candidates-20260926.zip` (09-26 13:3x) | `wave18/candidates-v1` | 46,874 KB | `4e99ed1addc4aa62…` | 91 | — | `raw/`·`generated/`·`references/` 제외 |
| `/tmp/astra-wave19-candidates-20260926.zip` (09-26 22:18) | `wave19/candidates-v1` | 67,936 KB | `67a53685d4ad8ee4…` | 98 | — | `raw/`·`generated/`·`references/` 제외 |
| `/tmp/astra-wave20-candidates-20260926.zip` (09-26 22:19) | `wave20/candidates-20260926` | 29,222 KB | `b7761f4372f384c7…` | 64 | — | `raw/`·`generated/`·`references/` 제외 |
| `/tmp/astra-wave20-rework-20260927.zip` (09-27 01:33) | `wave20/rework-20260927` | 18,747 KB | `5b8320fe6b7b8d36…` | 66 | — | `raw/`·`generated/`·`references/` 제외 | L0·L1 v1 8장은 원본과 같은 바이트라 건너뜀
| `/tmp/astra-portrait-pool3-candidates-20260927.zip` (09-27 11:24) | `portrait-pool/pool3-20260927` | 208,973 KB | `b4736870c38e2976…` | 199 | 78 | `raw/`·`references/`·`ui-reference/`·`revisions/raw`·`revisions/references` 제외 | approved-pilot 13·batch1 32·batch2 32·도구 1은 같은 바이트라 건너뜀. `ui-reference/` 6장은 Astra에 준 참조(Wave 14 문장 시트·Wave 19 틀 사본 2장 포함)라 넣지 않음
| `/tmp/astra-wave21-candidates-20260927.zip` (09-27 11:32) | `wave21/candidates-v1` | 402,211 KB | `72d9228426a97b8d…` | 111 | 0 | `raw/`(317MB)·`references/` 제외 |
| `output/astra-wave21-candidates-v1/` (작업 폴더) | `wave21/candidates-v1` | — | — | 0(ZIP과 같음) | — | 〃 |
| `/tmp/astra-wave22-candidates-20260927.zip` (09-27 11:20) | `wave22/candidates-20260927` | 4,753 KB | `03a2811c891fc290…` | 80 | 0 | 없음 |
| `/tmp/astra-wave21-rework-20260927.zip` (09-27 14:36) | `wave21/rework-20260927` | 509,389 KB | `eb436feb9583e6ee…` | 67 | 41 | `raw/`(408MB)·`references/` 제외 | 바뀌지 않은 원본 34장은 같은 바이트라 건너뜀
| `output/astra-wave21-rework-v1/` (작업 폴더) | `wave21/rework-20260927` | — | — | 0(ZIP과 같음) | — | 〃 |
| `/tmp/astra-wave22-rework-candidates-20260927.zip` (09-27 14:36) | `wave22/rework-20260927` | 15,554 KB | `799d6938e40cb12f…` | 81 | 35 | 없음 | 소품 20·전이 띠 10·해안 띠 5는 같은 바이트라 건너뜀
| `/tmp/astra-wave20-snow-v4.zip` (09-27 20:27) | `wave20/snow-v4-20260927` | 6,279 KB | `f9741e51eca68f8b…` | 80 | 0 | `references/`·`raw_*`·`generated_*`·`ref_*` 제외 | 확인 그림 2장·`qa/roof-audit/`는 사용자 지시로 `records/`
| `/tmp/astra-wave23-candidates-20260928.zip` (09-28 02:16) | `wave23/candidates-20260928` | 92,280 KB | `999eec8027d33c7f…` | 191 | 2 | `raw/`·`references/` 제외 | 작업 폴더 `output/astra-wave23-candidates-v1`과 바이트 같음. 맨 위 문서·`scripts/`는 `records/`로. 건너뛴 2장은 같은 묶음 안 같은 바이트(닭 보호 영역 그림)
| `/tmp/astra-lineage-pilot-20260928.zip` (09-28 08:53) | `lineage-pilot/pilot1-20260928` | 198,695 KB | `40aa71312992fa79…` | 142 | 0 | `raw/`·`references/` 제외 | 작업 폴더 `output/astra-lineage-pilot-v1`과 바이트 같음. 맨 위 문서·`prompts/`·`scripts/`는 `records/`로
| `/tmp/astra-lineage-pilot2-20260928.zip` (09-28 09:48) | `lineage-pilot/pilot2-20260928` | 84,943 KB | `2765cd745f2e62d6…` | 59 | 0 | `raw/`·`references/` 제외 | 작업 폴더 `output/astra-lineage-pilot2-v1`과 바이트 같음(작업 폴더에만 빈 `records/gentry/`). 맨 위 문서·`scripts/`는 `records/`로
| `/tmp/astra-lineage-prod1-candidates-20260928-lite.zip` (09-28 12:30, 경량판) | `lineage/prod1-20260928` | 71,463 KB | `828bb3aba3a6f2d9…` | 281 | 0 | `references/` 제외(경량판에 `raw/` 없음) | 전체판 `astra-lineage-prod1-candidates-20260928.zip`(538,294 KB, `cec1612b6a65cbc6…`, raw 포함)은 사용자 지시로 `astra-raw/zips`에만 보관. 경량판의 assets·proofs·records·references·scripts는 작업 폴더 `output/astra-lineage-prod1-v1`과 바이트 같음. 맨 위 문서(`LIGHTWEIGHT_README.md`·`FULL_ARCHIVE_SHA256SUMS.txt` 포함)·`scripts/`는 `records/`로
| `/tmp/astra-lineage-prod1-costume-v2-20260928-lite.zip` (09-28 13:00, 경량판) | `lineage/prod1-costume-v2-20260928` | 14,921 KB | `cc3ca41753c300e2…` | 80 | 0 | `references/`(편집 전 41장 사본) 제외 | 작업 폴더 `output/astra-lineage-prod1-costume-v2`와 바이트 같음(작업 폴더의 `node_modules` 링크 제외). ZIP 밖 `astra-lineage-prod1-costume-v2-delivery.json`은 `records/delivery.json`으로. 생성 고해상도 원본은 Astra가 `astra-raw/lineage-prod1-costume-v2/`(83MB)에 직접 둠
| `/tmp/astra-lineage-prod2-candidates-20260928-lite.zip` (09-28 14:15, 경량판) | `lineage/prod2-20260928` | 55,609 KB | `e0e4aa373fac7bcc…` | 199 | 31 | `references/` 제외 | 재사용한 세력 수장 14장은 초상 풀 3차와 같은 바이트라 넣지 않고 풀 3차 행 비고에 연결을 적음. `records/`의 교정본 사본 16장(`L7_*-v2`·`L7_303_young-attempt1`·`-selected-v2`)과 `proof-work/costume-preliminary.png`는 같은 묶음의 `assets/`·`proofs/`와 같은 바이트라 건너뜀(처음 커밋 7802f8a6에 들어갔다가 다음 커밋에서 뺌). 작업 폴더 `output/astra-lineage-prod2-v1`에만 있던 `records/delivery.json`·`records/proof-work/`(PNG 4)를 합침. 전체판 `astra-raw/zips/astra-lineage-prod2-candidates-20260928-full.zip`(343,605 KB, `fffbb843e5ecdc98…`)과 고해상도 원본 `astra-raw/lineage-prod2-20260928/`(286MB)은 Astra가 직접 둠, 저장소에 넣지 않음
| `/tmp/astra-wave24-candidates-20260928-lite.zip` (09-28 16:41, 경량판) | `wave24/candidates-20260928` | 47,185 KB | `4e35c0631dc02930…` | 54 | 0 | `references/` 제외 | `guides/` → `proofs/guides/`, `exports/` → `assets/exports/`. 작업 폴더 `output/astra-wave24-v1`에만 있던 검수 그림 4·`PLAN.md`·`package-result.json`을 합침, 생성 원본 `*-native*.png` 22장은 제외(Astra가 `astra-raw/wave24-20260928/` 148MB에 직접 둠)
| `/tmp/astra-wave25-candidates-20260928-lite.zip` (09-28 20:08, 경량판) | `wave25/candidates-20260928` | 1,485 KB | `50de4fa93b118140…` | 38 | 0 | `references/` 제외 | 작업 폴더 `output/astra-wave25-v1`에만 있던 `records/package-result.json`을 합침, 생성 원본·중간본(`native/`, `records/*-native*.png`·`frame-base-initial.png`)은 제외(Astra가 `astra-raw/wave25-20260928/` 14MB에 직접 둠)
| `/tmp/astra-wave26-candidates-20260928-lite.zip` (09-28 20:42, 경량판) | `wave26/candidates-20260928` | 6,291 KB | `8212892ee26fabd9…` | 144 | 0 | `references/`(기존 주택 5장 등) 제외 | 작업 폴더 `output/astra-wave26-v1`에만 있던 `records/package-result.json`을 합침, 생성 원본 `native/`는 제외(Astra가 `astra-raw/wave26-20260928/` 115MB에 직접 둠)
| `/tmp/astra-wave27-candidates.zip` (09-28 20:35) | `wave27/candidates-20260928` | 3,983 KB | `1d92d3fe919ba88f…` | 61 | 0 | `references/` 제외 | `qa/`·`provenance/`는 `records/` 아래로. ZIP 밖 `astra-wave27-package-verification.json`은 `records/package-verification.json`으로. 작업 폴더는 `output/`이 아니라 `/tmp/astra-wave27-work`(83MB, 그 안 `delivery/`가 ZIP과 바이트 같음)라 `astra-raw/output/astra-wave27-work/`에 통째로 보관
| `/tmp/astra-wave28-candidates-20260928-lite.zip` (09-28 21:29, 경량판) | `wave28/candidates-20260928` | 5,148 KB | `ced2fa9905c6c202…` | 99 | 0 | `references/` 제외 | 작업 폴더 `output/astra-wave28-v1`에만 있던 확인 그림 합성 층 6(`records/overlay-*`·`scene-*`)·`package-result.json`을 합침, 생성 원본 `native/`는 제외(Astra가 `astra-raw/wave28-20260928/`에 직접 둠). `records/`의 검수 JPG 3장도 장부 행
| `/tmp/astra-wave29-candidates.zip` (09-28 21:23) | `wave29/candidates-20260928` | 5,048 KB | `6b657b03d8c6b6bc…` | 68 | 2 | `provenance/reference/`(기존 물가·갈대 참조 사본 5) 제외 | 미리보기(`all_effects_loop.webp`·대표 프레임 PNG)는 사용자 지시로 `records/previews/`, `qa/`·`provenance/`는 `records/` 아래로. 건너뛴 2장은 같은 묶음 안 같은 바이트(`ice_edge-preview` = 정적 시트, `qa/browser-3` = `browser-2`). ZIP 밖 `astra-wave29-package-verification.json`은 `records/package-verification.json`으로. 작업 폴더 `/tmp/astra-wave29-work`(32MB, `delivery/`가 ZIP과 바이트 같음)는 `astra-raw/output/astra-wave29-work/`에 보관
| `/tmp/astra-wave30-candidates-20260929-lite.zip` (09-29 08:56, 경량판) | `wave30/candidates-20260929` | 8,039 KB | `2971276e0417bcf5…` | 218 | 2 | `references/`(첨부 원본 6 등) 제외 | 마스크는 `records/masks/`. 건너뛴 2장은 같은 묶음 안 같은 바이트 마스크(`l2v-e-roof` = `l2v-d-roof`, `l3v-e-roof` = `l3v-d-roof`). 작업 폴더 `output/astra-wave30-v1`에만 있던 `records/bases-progress.png`·`package-result.json`을 합침, 생성 원본 `native/`는 제외(Astra가 `astra-raw/wave30-20260929/` 123MB에 직접 둠). 확인 그림 2장은 JPG
| `/tmp/astra-wave31-candidates.zip` (09-29 08:39) | `wave31/candidates-20260929` | 3,860 KB | `36c751f174773007…` | 16 | 0 | 없음 | `illustrations/` → `assets/illustrations/`, `provenance/`(프롬프트·원본 해시) → `records/provenance/`. 작업 폴더 `/tmp/astra-wave31-work`의 `package-verification.json`은 `records/`로, 작업 폴더 전체(`delivery/`가 ZIP과 바이트 같음)는 `astra-raw/output/astra-wave31-work/`에 보관. 네 장 모두 JPG
| `/tmp/astra-wave32-candidates-20260929-lite.zip` (09-29 09:41, 경량판) | `wave32/candidates-20260929` | 5,420 KB | `843c3d8f7089d712…` | 105 | 0 | `references/`(현재 `barn.png` 등) 제외 | 마스크는 `records/masks/`. 작업 폴더 `output/astra-wave32-v1`에만 있던 `records/package-result.json`을 합침, 생성 원본 `native/`는 제외(Astra가 `astra-raw/wave32-20260929/` 42MB에 직접 둠). `/tmp`의 포장 시도 폴더 둘 중 하나는 ZIP과 같고 하나는 `PLAN.md`만 다름. 확인 그림 2장은 JPG
| `/tmp/astra-wave33-candidates-20260929-lite.zip` (09-29 13:13, 경량판) | `wave33/candidates-20260929` | 9,128 KB | `161793154b37cc05…` | 19 | 0 | `references/`(Wave 21 참조 JPG 3) 제외(사용자 지시) | 작업 폴더 `output/astra-wave33-v1`과 바이트 같음, 생성 원본 `native/`는 제외(Astra가 `astra-raw/wave33-20260929/` 17MB에 직접 둠). 확인판 `contact.jpg`는 JPG
| `/tmp/astra-wave32-rework-20260929-lite.zip` (09-29 09:49, 경량판) | `wave32/rework-20260929` | 4,552 KB | `55102d27d7985a52…` | 26 | 25 | `references/` 제외 | 26장 가운데 바뀐 것은 `granary_b_snow-v1`·`granary_b_boarded-v1` 둘뿐(해시 대조). 원래 납품과 바이트가 같은 24장·기록 마스크 1장과 `records/previous/`(원래 묶음 기록 사본 58파일)는 넣지 않음. 작업 폴더 `output/astra-wave32-rework-v2`에만 있던 `records/package-result.json`을 합침, 생성 원본 `native/`는 제외(Astra가 `astra-raw/wave32-rework-20260929/`에 직접 둠)
| `/tmp/astra-wave34-candidates-20260929.zip` (09-29 19:42) | `wave34/candidates-20260929` | 3,193 KB | `90db8e9bf0e3fb33…` | 55 | 0 | `references/`(7), `records/proof-inputs/`(확인 그림을 만들 때 쓴 기존 게임 그림 사본 10) 제외 | `ford/`·`drain/`·`props/` → `assets/` 아래, `checks/` → `proofs/`. ZIP 밖 `astra-wave34-sha-validation.txt`는 `records/sha-validation.txt`로. 작업 폴더 `/tmp/astra-wave34-work-20260929`(2.3MB)는 `astra-raw/output/`에 보관. 생성 원본 보존 폴더는 없음
| `/tmp/astra-wave34-stage3-regions-candidates-20260929.zip` (09-29 20:45) | `wave34/stage3-regions-20260929` | 1,796 KB | `c37b68ece8e69edc…` | 22 | 0 | 없음(고해상도 원본·참조·기존 에셋은 ZIP에 없음) | `drain/` → `assets/drain/`, `checks/` → `proofs/`. 작업 폴더 `/tmp/astra-wave34-stage3-regions-work-20260929`는 `astra-raw/output/`에 보관. 중간 v2 ZIP(`astra-wave34-stage3-rework-candidates-20260929.zip`)은 사용자 판정대로 inbox에 넣지 않고 ZIP·작업 폴더만 astra-raw에 보관
| `/tmp/astra-wave35-candidates-20260930-lite.zip` (09-30 11:21, 경량판) | `wave35/candidates-20260930` | 9,345 KB | `0b52373caf15fa4c…` | 137 | 0 | `references/` 제외 | `qa/`·`prompts/`·`tools/`는 `records/` 아래로. 경량판은 `raw/`(생성 원본·반려 이력)를 빼고 `RAW_INDEX.json`에 경로·크기·SHA를 실음. 작업 폴더 `output/astra-wave35-candidates-20260930`(`raw/` 114MB 포함)은 `astra-raw/output/`에 보관. 확인 그림 2장은 JPG
| `/tmp/astra-wave36-building-kit-pilot-20260930-lite.zip` (09-30 12:08, 경량판) | `experiments/wave36-building-kit-pilot-20260930` | 25,308 KB | `42fbe518b780edb2…` | 139 | 3 | `references/`, `renders/`(216 기본·210 상태 조합과 간판 15·색 입힘 12, 453장), `sources/`, `blind/`의 개별 PNG 48(렌더 사본 24·Wave 26 원본 사본 24) 제외 — 사용자 지시로 저장소에 넣지 않고 astra-raw에만 | 실패한 실험 기록이라 새 최상위 폴더 `experiments/`에 둠. 문서·`prompts/`·`records/`·`tools/`·`qa/`·`masks/`·`blind/`의 시트와 CSV는 `records/` 아래로. 건너뛴 3장은 같은 묶음 안 같은 바이트 마스크(`roof_stone`·`roof_thatch`·`roof_tile` = `roof_canonical`). 작업 폴더 `output/astra-wave36-candidates-20260930`(89MB, 렌더·생성 원본 포함)은 `astra-raw/output/`에 보관
| `/tmp/astra-wave37-doorstep-trade-props-20260930-lite.zip` (09-30 12:51, 경량판) | `wave37/candidates-20260930` | 4,388 KB | `7fbb88ef01f65d83…` | 116 | 0 | `references/` 제외 | `proofs/`의 확인 그림 JPG 3장만 `proofs/`에 두고 같은 폴더의 작업 접촉판 PNG 4장은 `records/contacts/`로. `blind/`(판독 시험)·`qa/`·`prompts/`·`tools/`·`rejected/r1/`(1차 교정 이력)은 `records/` 아래로. 경량판은 `raw/`를 빼고 `RAW_INDEX.csv`에 경로·해시를 실음. 작업 폴더 `output/astra-wave37-candidates-20260930`(56MB, `raw/` 포함)은 `astra-raw/output/`에 보관. 같은 폴더의 `output/astra-wave37-rework-v2`(진행 중인 재작업)는 받지 않음
| `/tmp/astra-wave37-rework-v2-lite.zip` (09-30 13:28, 경량판) | `wave37/rework-v2` | 828 KB | `8a0c102d9a268b15…` | 26 | 30 | `references/` 제외 | 32장 가운데 바뀐 것은 `condition_prosperous_bench`·`trade_carpenter_a`·`trade_miller_a`·`trade_miller_b` 넷뿐(해시 대조). 원본과 바이트가 같은 28장과, 같은 묶음 새 방앗간 그림과 바이트가 같은 판독 그림 2장(`blind/01`·`02`)은 넣지 않음. 작업 폴더 `output/astra-wave37-rework-v2`(9.5MB)는 `astra-raw/output/`에 보관
| `/tmp/astra-endings-empty-manors-candidates-20260930.zip` (09-30 19:25) | `endings-manors/candidates-20260930` | 5,730 KB | `a65493ddf075fdf0…` | 23 | 0 | 없음 | `checks/` → `proofs/`. 결말 6장은 JPG라 각각 장부 한 행. 작업 폴더 `/tmp/astra-endings-empty-manors-work-20260930`(1MB)는 `astra-raw/output/`에 보관
| `/tmp/astra-manor-b-empty-rework-candidates-20260930.zip` (09-30 19:45) | `endings-manors/manor-b-rework-20260930` | 411 KB | `3781bfc8d890b93b…` | 13 | 0 | 없음 | `checks/` → `proofs/`. 작업 폴더 `/tmp/astra-manor-b-empty-rework-work-20260930`(합성 중간본 `normalized.png` 포함)는 `astra-raw/output/`에 보관
| `/tmp/astra-wave39-candidates-20260930.zip` (09-30 21:05) | `wave39/candidates-20260930` | 5,243 KB | `323c2ba015360594…` | 100 | 0 | 없음(참조는 ZIP에 없음) | `checks/` → `proofs/`. 작업 폴더 `/tmp/astra-wave39-work-20260930`(13MB, 참조 사본·재료별 작업 폴더 포함)은 `astra-raw/output/`에 보관
| `/tmp/astra-wave38-candidates.zip` (09-30 20:20, 10-01에 받음) | `wave38/candidates-20260930` | 913 KB | `3cbdfb969a1c07c4…` | 121 | 0 | 없음(참조는 ZIP에 없음) | `assets/`·`proofs/`는 그대로, `README.md`·`QA_CHECKLIST.md`·`assets.csv`·`SHA256SUMS`·`provenance/`·`qa/`는 `records/` 아래로. 9-30에 판정만 하고 inbox에 넣지 않았던 것을 재작업 묶음과 함께 받음. 작업 폴더 `/tmp/astra-wave38-work`(16MB, 참조 사본·생성 원본 포함)은 `astra-raw/output/astra-wave38-work-20260930`에 보관
| `/tmp/astra-wave40-with-wave38-rework-20261001.zip` (10-01 19:46) 중 `wave38-rework/` | `wave38/rework-20261001` | 6,569 KB(묶음 전체) | `b0ff022ba4ef66fa…` | 17 | 0 | `reference/`(원본 Wave 38 11장, 바이트 같음) 제외 | `9slice-proof.png`·`comparison.jpg` → `proofs/`, 나머지 기록은 `records/`. 묶음 맨 위 `README.md`·`SHA256SUMS`는 두 묶음의 `records/`에 같은 사본. 작업 폴더 `/tmp/astra-wave40-work`(9.2MB, 두 묶음 공용)은 `astra-raw/output/astra-wave40-work-20261001`에 보관
| 같은 ZIP 중 `wave40/` | `wave40/candidates-20261001` | — | — | 25 | 0 | `reference/`(Wave 21·33 화풍 참조 2), `revision-reference/`(13번 수정 전 v1 JPG 1) 제외 | `contact-sheet.jpg` → `proofs/`, 나머지 기록은 `records/`. 사건 JPG 14장은 장부에 각각 한 행
| `/tmp/astra-lord-components-20261002-lite.zip` (10-02 00:59, 경량판) | `lord-components/candidates-20261002` | 5,381 KB | `ef31988f33711b59…` | 88 | 0 | 없음(`raw/`·`references/`는 비어 있고 ZIP에 없음) | `assets/` 40·`proofs/` 3은 그대로, `README.md`·`QA.md`·`assets.csv`·`SHA256SUMS.txt`·`prompts/`(최종 프롬프트 34)는 `records/` 아래로, ZIP의 `records/`는 `records/`에 그대로. 생성 원본은 Astra 도구 폴더에 있고 경로·해시는 `records/generations.json`. 작업 폴더 `/tmp/astra-lord-components-20261002`(ZIP과 같은 내용)는 `astra-raw/output/`에 보관
| `/tmp/astra-wave41-candidates-20261002-lite.zip` (10-02 01:24, 경량판) | `wave41/candidates-20261002` | 9,584 KB | `75aca3003432b7a7…` | 98 | 0 | 없음(생성 원본 33·참조는 ZIP에 없음) | `assets/` 29·`proofs/` 14는 그대로, `README.md`·`QA.md`·`assets.csv`·`SHA256SUMS.txt`·`DELIVERY_VALIDATION.json`은 `records/` 아래로, ZIP의 `records/`는 `records/`에 그대로. 맨 위 `ART_BIBLE_v2.md`는 `records/ART_BIBLE_v2.md`와 같은 바이트라 한 번만. 작업 폴더 `galeocerdo/output/astra-wave41-candidates-20261002-v1`(86MB)과 준비 폴더 `/tmp/astra-wave41-planning`(2.8MB)은 `astra-raw/output/`에 보관
| `/tmp/astra-wave41-expanded-20261002-lite.zip` (10-02 10:08, 경량판·통합본) 중 `additions6/` | `wave41/additions-20261002` | 10,315 KB(통합본 전체) | `3e5a087ff2279762…` | 34 | 99 | 없음(생성 원본은 ZIP에 없음) | `base29/` 99개는 `wave41/candidates-20261002`와 바이트가 같아(파일마다 대조) 넣지 않음. `additions6/`의 `assets/`(`boundary/`·`ford/` 하위 경로 유지)·`proofs/`는 그대로, `README.md`·`QA.md`는 `records/` 아래로. `records/ART_BIBLE_v2.md`는 앞 묶음 것과 같은 바이트라 뺌. 통합본 맨 위 `README.md`·`assets.csv`·`SHA256SUMS.txt`·`DELIVERY_VALIDATION.json`은 이름이 겹쳐 `records/bundle/`. 작업 폴더 `bramble/output/astra-wave41-additions-20261002-v1`(5.5MB, 생성 원본 `raw/` 포함)과 통합본 폴더 `/tmp/astra-wave41-expanded-20261002`는 `astra-raw/output/`에 보관
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
- **Wave 18**: 에셋 41장 `confirmed`(17시 판정), 확인 그림 3·기록 그림 4도 `confirmed`. 재사용 계절 알약 `reused/pill_season_*` 4장은 Wave 8 원본과 SHA가 다르고, UI-P0 `icon_resource_sheet.png`의 셀 5~8을 잘라낸 것과 픽셀이 같다(비고에 표시, 중복으로 빼지 않음).
- **Wave 19**: 에셋 53장 `confirmed`(확인·기록 그림 포함).
- **Wave 20**: 집 20장 확정 — L0·L1 v1 8장 `confirmed`, L2~L4 v1 12장 `superseded`(→ `rework-20260927`의 v2), v2 12장 `confirmed`. 재작업 묶음의 새 오버레이 9장(`boarded_*-v3`·`roof_snow_*-v3`)은 판정 전이라 `candidate`. `provenance/generated/*-raw.png`는 원시 생성본이라 넣지 않았다. v3 오버레이(17시 판정): `boarded_l2~l4_{1350,1400}-v3` 6장 `confirmed`, `roof_snow_l2~l4_shared-v3` 3장 `rework_pending`. 지붕 눈 v4(`wave20/snow-v4-20260927/`, 20시 판정): `roof_snow_l{2,3,4}_{1350,1400}-v4` 6장 `confirmed`, `roof_snow_l2~l4_shared-v3` 3장은 `superseded`(→ 같은 등급의 1350·1400 v4 두 장). 확인 그림 2장과 지붕 마스크 검수 29장은 `records/`에 두고 `confirmed`. **Wave 20 확정 = 본체 20 + 판자 6 + 눈 6 = 32장.**
- **초상 풀 2차**(`portrait-pool/pool2-20260926`): 초상 92장과 확인·기록 그림 14장 `confirmed`(17시 판정). CHRON-1이 판정 전에 설치한 빌드 파생 184개가 이제 확정본이다.
- **Wave 17**: 57장 `confirmed`(13시 판정). 그중 `animal_walk/ox-v1`·`cart/ox_cart_body-v1`은 Wave 13의 같은 이름 파일과 SHA가 같아 중복으로 보고 `wave17/`에서 빼고 Wave 13 행 비고에 표시했다(inbox에는 55장). `wall/stone_wall_repair_scaffold`는 비고 "설치 시 석벽 v2 옆에서 톤 확인". 확인·기록 그림 9장도 `confirmed`.
- **Wave 16**: 11:21 도착. 에셋 35장 `confirmed`(13시 판정), 확인 그림 11·기록 그림 3도 `confirmed`(비고에 표시).
- **Wave 3**: 재작업본 10장 `confirmed`, 해당 v1 10장 `superseded`(→ `wave3/fix-20260926/assets/…`). Wave 3 에셋 82장 확정.
- **초상 풀 3차**(`portrait-pool/pool3-20260927`): 세력 인물 24명(I101~I124) × 청년·장년·노년 72장 `confirmed`(14시 판정), 확인 그림 5·기록 그림(수정 전 판) 10도 `confirmed`. 풀 합계 304장(파일럿 48·1차 92·2차 92·3차 72). ID로 센 인물은 124명(P01~P36 36명 + I037~I124 88명)이고, README의 "100명"은 청년 비교 격자(풀 88명 + 파일럿 12명) 기준이다. 2차 92장은 아직 `candidate`.
- **Wave 21**: 58장 확정(15시 판정). 재작업(`wave21/rework-20260927/`) 24장 `confirmed` — `ch3_ending`과 4·5장 23장 — 이고 그 v1 24장은 `superseded`(→ 같은 이름의 재작업본). 바뀌지 않은 원본 34장(3장 18·4장 10·5장 6)은 `confirmed`. 확인 그림은 처음 묶음 5장(`*-contact.png` 2장 포함)과 재작업 3장 모두 `confirmed`. `raw/`는 넣지 않았다.
- **Wave 22**: 81장 확정(16시 판정). 처음 묶음의 소품 20·전이 띠 10·해안 띠 5 `confirmed`, 재작업(`wave22/rework-20260927/`, 14:36 도착)의 지면 fill v2 30장(15종 × a·b)·특징 데칼 15·`shore/sand_beach_a-v2` `confirmed`. 옛 fill 15와 `sand_beach_a-v1`은 `superseded`(fill은 a·b 두 장을 `replaced_by`에 `;`로 적음). 확인 그림은 처음 3·재작업 3 모두 `confirmed`. 흩뿌리기 배치 코드(오프라인 결정론 배치 `scatter-v1`)는 `records/proofs.cjs`, 배치 계약 `records/proofs-placement-contract.md`, 결과 좌표 `records/proofs-placement.json`에 있다(게임 코드 아님).
- **오래된 candidate 172행 정리**(21시, 사용자 규칙): ① runtime에 같은 SHA·caBX만 다른 바이트·같은 픽셀 → confirmed + `installed_by`: 해당 0행. ② 같은 ID의 더 새 판 확정 → superseded: `wave2/pilot-20260924/assets/house_l2_brewer-pilot.png` 1행(→ `wave2/house_l2_brewer-v1.png`). ③ `asset-trial`·`wave4-pilot` → rejected "방식 시험용, 제품 아님" 24행, 비교 그림 `asset-comparison.png`·`comparison.png` 2행은 확인 그림으로 confirmed. ④ Wave 5a 후보판(`candidates-v1`·`candidates-v2-29sheets`) → 설치된 V2 워커 시트와 픽셀이 같은 것이 없어 87행 rejected "V2 설치에서 선택되지 않음". 규칙 밖 58행은 `candidate` 그대로 두고 비고에 "규칙 밖: 사유 — 제안"을 적었다. 각 행 비고 끝에 "(2026-09-27 정리)".
- **규칙 밖 58행 판정**(21시, 사용자 판정, INBOX-1p): 확정 묶음의 확인·기록 그림 30행 → confirmed "확인 그림". `wave4e/candidates-v1/assets/masters` 워커·망토 8장 → superseded, `replaced_by`에 같은 이름의 확정본(`wave4e/workers`·`wave4e/overlays`; 같은 그림의 먼저 받은 판, 바이트만 다름). `wave4e/candidates-v1/assets/templates/actor_*` 3장 → rejected "재스킨 참조 템플릿, 제품 아님(확정 템플릿은 derived-templates)". `wave4c` 울타리 이음 위상 마스크 5장 → confirmed "보조 자료(기록), 게임 코드 미사용". `wave2/farm_mixed_*` 4장 → retired(같은 바이트가 `retired/buildings/variants-wave2/`에 있음, C1f 퇴역). `wave5b/.../reused/held_staff_*` 4장 → superseded, `replaced_by`에 `walker-pilot2/candidates-v1/assets/props/`의 같은 바이트 확정본("다른 Wave 중복"). `wave2/hold/farm_pastoral_*` 3장 → candidate 유지 "C5(직물·목축) 때 판정 — 보류". `wave2/production-20260924/assets/house_l1_thatch-v1.png` → rejected "L1 초가는 runtime house_l1-v2가 담당, 이 판은 설치되지 않음". `asset-trial/evidence` 캡처 12장은 rejected 그대로. 각 행 비고 앞에 판정, 끝에 "(2026-09-27 판정) · 정리 때 비고: …". 남은 candidate는 목축형 농장 3행뿐.
- **Wave 23**: 82장 전부 확정(2026-09-28 판정). 날씨 14(비고 "설치 때 세기 조정"), 마을 생활 새 4·동물 8(비고 "설치 때 작은 동물 1.6배 가독성 배율"), 마을 생활 소품 8, 인물 상태 장식 24(12종 × 96·48 px; `person_state/newborn_{48,96}`은 비고 "부모 초상용 '아이를 얻음'으로 사용(이름 변경 예정)"), 왕실 문장 4(1340 전·후 × 256·96), 패드 표시 20(10종 × 48·32). 확인 그림 4·기록 그림 34도 `confirmed`. 다른 Wave와 같은 바이트 없음.
- **혈통 파일럿 1**(`lineage-pilot/pilot1-20260928`, 2026-09-28): 90장 전부 `candidate`, 비고 "파일럿 1 — 가족 묶기 통과, 형제 구별 실패, 파일럿 2 대기". 두 가문 68장(창시 부부 장년·노년 8, 자녀 4명 × 아기·어린이·청년·장년 32, 손자 4명 × 아기·어린이·청년 24, 외부 배우자 청년 4) + 평민 아기·어린이 공통 풀 12 = 256 px 초상 80장, 확인 그림 4·기록 그림 6. 공통 풀 12장과 아기 → 청년 사슬 48장(자녀·손자의 아기·어린이·청년)은 비고에 "파일럿 2 결과와 함께 판정"을 더했다.
- **혈통 파일럿 2와 파일럿 1 판정**(2026-09-28 10시, 사용자 판정): 파일럿 2(`lineage-pilot/pilot2-20260928`)는 파일럿 1에서 구별에 실패한 형제 3쌍(L1_203·204, L2_201·202, L2_203·204) 여섯 인물의 아기·어린이·청년·장년 24장을 다시 그렸다(익명 동일인 구별 12/12 통과). 24장과 확인 그림 3 `confirmed`. 파일럿 1의 같은 여섯 인물 24장(아기 포함)은 `superseded`, `replaced_by`에 파일럿 2의 같은 이름 판. 파일럿 1의 나머지 초상 44장(창시 부부 8, 구별된 자녀 L1_201·202 8, 외부 배우자 4, 손자 24) `confirmed` — 그 가운데 아기 10장은 비고 "아기 단계 확정 — 파일럿 1 아기가 기준". 공통 풀 12장은 `candidate` 유지, 비고 "본 제작 1차 공통 풀과 함께 판정". 파일럿 1 확인 그림 4·기록 그림 6도 `confirmed`(사용자 확인).
  - **파일럿 2 아기 6장 재작업 대기**(10시 판정): `L1_203·204`, `L2_201·202·203·204`의 `_baby`는 `rework_pending`, 비고 "3~5살로 보임 — 파일럿 2 얼굴에 맞춘 0~2살 아기로 재작업". 파일럿 1의 같은 인물 아기 6장은 `superseded` 그대로(`replaced_by`는 파일럿 2 아기 — 재작업본이 오면 그 판으로 바꾼다). 파일럿 2 확정은 21장(초상 18·확인 그림 3).
- **혈통 본 제작 1차**(`lineage/prod1-20260928`, 2026-09-28 12시 판정, 경량판): 256 px 초상 160장. L3 영주 가문 A 38·L5 reeve 가문 38·공통 풀 40(아기 14·걸음마 12·어린이 14)·파일럿 2 아기 v2 6 `confirmed`, L4 양모·직물 상인 가문 38 `rework_pending`(비고 "상인 복식 재작업"). 확인 그림 4·기록 그림 27 `confirmed`. 파일럿 2 `_baby` 6장은 `superseded`(→ `assets/pilot2-baby/*_baby-v2.png`), 파일럿 1의 같은 인물 아기 6장도 `replaced_by`를 v2로 옮겼다. 파일럿 1 공통 풀 12장 중 이번에 재사용된 4장(`L0_005`·`L0_006`·`L0_008` 걸음마, `L0_011` 어린이 = `C_toddler_02`·`01`·`03`, `C_child_01`과 같은 바이트) `confirmed`, 나머지 8장 `rejected`(비고 "본 제작 공통 풀로 대체"). 같은 바이트 네 쌍은 양쪽 비고에 서로를 적었다.
  - **복식 교정 v2**(`lineage/prod1-costume-v2-20260928`, 13시 판정): L4 상인 가문 38장(청·자주 고운 모직·모피 깃·후드/혼인별 머리쓰개)과 L5_102 청년·장년·노년 3장(올리브 모직·황토빛 머리수건, 다른 L5와 구별) `confirmed`, 확인 그림 4 `confirmed`. 옛 L4 38장(`rework_pending`)과 옛 L5_102 3장(`confirmed`)은 `superseded`, `replaced_by`에 같은 이름의 v2. 본 제작 1차는 이제 재작업 대기 0.
- **같은 바이트 정본 표시**(2026-09-28, INBOX-1y): 장부 전체에서 sha256이 같은 행이 215묶음 460행(2장 201·3장 13·19장 1)이었다. 묶음마다 정본을 하나 정하고 나머지 245행 비고에 `○○와 동일 바이트(정본: 경로)`를 더했다. 상태는 바꾸지 않았다. 정본이 confirmed인 묶음 111, confirmed가 없어 가장 먼저 받은 행을 정본으로 둔 묶음 104(대부분 wave5a·wave10·wave7의 rejected·superseded). 정본의 받은 때는 196묶음이 원본 ZIP·작업 폴더 시각, 19묶음이 Wave의 가장 이른 원본 시각(`wave4-pilot/road/` 같은 묶음 폴더 밖 행). 확정본 없는 104묶음은 그대로 둔다(사용자 판정).
- **Wave 24 Steam 상점 그림**(`wave24/candidates-20260928`, 16시 판정, 경량판): 원화 10(헤더 920×430·작은 캡슐·메인·세로·라이브러리 캡슐·히어로 3840×1240·엠블럼·페이지 배경·앱 아이콘 PNG·바로가기 아이콘), 안전 영역 가이드 10(`proofs/guides/`), 앱 아이콘 JPG 1(`assets/exports/`, 장부의 첫 JPG 행) `confirmed`. `steam_library_hero` 비고 "AI 업스케일 재처리 예정(단순 확대본)" — 2152×731 생성 원본을 확대한 판, `steam_library_logo_emblem` 비고 "알파 8 미만 잔여 픽셀 정리 예정". 확인 그림 2·기록 그림 4 `confirmed`.
  - **후처리**(`wave24/processed-20260928`, 2026-09-28 17시, 사용자 지시): 4장을 새로 만들어 `confirmed`로 두고, 원래 4행은 `superseded`(`replaced_by`는 새 경로)로 바꿨다. 비교 확인 그림 JPG 1장도 `confirmed`다. 처리 기록은 [`README.md`](../assets-inbox/wave24/processed-20260928/records/README.md)·`processing.json`에 있다.
    - 히어로: 생성 원본 `hero-native-v4`(2152×731)를 Real-ESRGAN x2plus로 2배 확대하고, Lanczos로 3840×1240에 맞췄다(DGX GPU). 가장자리는 또렷해졌지만 붓 질감은 매끈해졌다. 100% 비교가 `proofs/`에 있다.
    - 엠블럼·앱 아이콘 PNG·바로가기 아이콘: 알파 8 미만 픽셀(16,541 · 1,052 · 1,761)을 RGBA (0,0,0,0)으로 바꿨다.
    - **사용자 판정**(2026-09-28): Steam 히어로는 AI 확대본으로 올린다. 큰 화면에서는 단순 확대본의 흐린 윤곽이 더 거슬린다. 아이콘 두 장까지 대체한 것은 그대로 둔다.
  - **정본 순서에 runtime 참조를 맨 앞으로**(2026-09-28, INBOX-1z, 사용자 판정): runtime manifest나 설치 대장이 가리키는 행을 먼저 정본으로 둔다. 가리켜지는 inbox 경로 1,025개(설치 대장 1,025, 그중 초상 manifest 304·Wave 16 삽화 35·Wave 17 22)로 215묶음을 다시 보니 정본이 바뀌는 묶음은 없었다. 가리켜지는 행이 둘인 묶음은 pivot-pilot 4쌍(`P01`·`P08`·`P14`·`P20`의 `portraits/`와 `aging/…_young` — 초상 manifest와 설치 대장이 두 ID로 둘 다 가리킴)뿐이라 사용자 판정대로 `portraits/`를 정본으로 바꿨다.
- **혈통 본 제작 2차**(`lineage/prod2-20260928`, 2026-09-28 15시 판정, 경량판): L6 백작 가문·L7 인접 기사 가문·L8 방앗간 가문 각 12명 38단계 = 114장 가운데 새 초상 100장(L6 30·L7 32·L8 38) `confirmed`. 재사용한 세력 수장 14장(L6_101·102, L7_101·102의 청년·장년·노년, L6_201의 청년·장년)은 초상 풀 3차 I101·I102·I107·I108·I103과 바이트가 같아 파일을 넣지 않았다. 장부 행 = PNG 수를 지키려고 새 행을 만들지 않고, 풀 3차의 해당 14행(`confirmed`) 비고에 "초상 풀 3차 I1xx와 동일 — 혈통 L6/L7_…로 연결"을 더했다. 확인 그림 4·기록 그림 34(작업 폴더의 `proof-work` 3 포함) `confirmed`. 같은 묶음 안에서 `assets/`·`proofs/`와 바이트가 같은 기록 사본 17장은 넣지 않았다.
- **replaced_by 경로 검사**(2026-09-28, INBOX-1q): `ui-p0/pilot/cursor_sheet.png`의 `replaced_by`가 패턴(`ui-p0/ui/cursor_*.png(6장)`)이던 것을 실제 경로 6개(`cursor_select`·`cursor_place_valid`·`cursor_place_invalid`·`cursor_road_draw`·`cursor_zone_brush`·`cursor_inspect`)로 고쳤다. 이 행이 장부 전체에서 없는 파일을 가리키던 유일한 행이었다. 같은 커밋부터 `npm run check:merge`의 다섯째 검사 `ledger`가 장부에 없는 `replaced_by` 경로를 실패로 본다.

- **Wave 25 가계도 UI 부품**(`wave25/candidates-20260928`, 2026-09-28 20시 판정, 경량판): 부품 16장(인물 틀 기본·선택·고인 176×216 9-slice, 혈통 배너, 세대 라벨, 가지선 가로·세로·코너 4·T자, 혼인 고리, 바깥 배우자 표식, 펼치기·접기) `confirmed`. 확인 그림 1장 `confirmed`, 비고 "바깥 배우자가 부모 가지선에 매달린 배치는 틀림 — UI-7에서 혼인 고리로만 연결".
- **Wave 26 주택 다양화**(`wave26/candidates-20260928`, 2026-09-28 20시 판정, 경량판): 1300 양식 L0~L4 등급마다 새 변형 4종(c·d·e·f) = 20장, 변형마다 낡음·새로 지음·눈·판자 상태 오버레이 = 80장, 확인 그림 3장 모두 `confirmed`. 지붕은 초가 13·기와 5·회갈색 돌판 2(L4 e·f). 돌판 지붕 `house_l4_e_snow-v1`·`house_l4_f_snow-v1`은 비고 "설치 때 피복률 60~80% 확인". 상태 오버레이는 같은 변형 전용(다른 변형에 공용으로 얹지 않음), 캔버스는 기존 등급 원본과 같다.
- **Wave 27 집 뒷마당 데칼**(`wave27/candidates-20260928`, 2026-09-28 21시 판정): 직업 12종 × A/B 24장, 형편·상태 6종 × A/B 12장(256×128), 공용 4장(128×64) = 40장과 확인 그림 2장 `confirmed`. 이름을 가린 판독용 기록 그림 1장(`records/qa/`)도 `confirmed`. 배치 기준점 256×128 (128,104)·128×64 (64,52), 알파 경계로 자르지 않는다.
- **Wave 28 성벽 밖 시골 풍경**(`wave28/candidates-20260928`, 2026-09-28 22시 판정, 경량판): 경계 띠 4종(생울타리 a·b, 밭둑, 마른 돌담)·점 소품 7종(참나무, pollard 버드나무, 돌 십자가, 건초더미, 양 우리, skep 벌통 줄, 경계석)·들판 2종(소형·대형) × 여름·가을·겨울 = 39장(봄은 여름 공유)과 확인 그림 2 `confirmed`. 기록 그림 9(검수 JPG 3, 작업 폴더의 합성 층 6)도 `confirmed`.
- **Wave 29 물 움직임**(`wave29/candidates-20260928`, 2026-09-28 22시 판정): 효과 시트 14장(잔물결·얕은 물 잔물결·물가 거품·갈대 흔들림 a·b·c·흐름 화살표 4방향·물레방아 도랑 급류·물고기 고리·반짝임·정적 얼음 테, 77프레임)과 확인 그림 2 `confirmed`. 미리보기 영상 `all_effects_loop.webp`와 대표 프레임 PNG 13장은 사용자 지시로 `records/previews/`(PNG는 `confirmed` 기록 그림), 브라우저 검수 그림 3장도 `confirmed`. 잔물결 알파는 PNG에 이미 반영됨(추가 0.25 곱셈 없음), 거품·얼음은 X축만 반복.
- **목축형 농장 보류 해제**(2026-09-29, INBOX-2g, 사용자 판정): `wave2/hold/farm_pastoral_{spring,summer,winter}-v1` 3장 `confirmed`, 비고 "C5 목축 농장 그림(CL8)". 이로써 장부에 판정 없는 그림(`candidate`·`rework_pending`)이 0이다.
- **Wave 30 합필 집**(`wave30/candidates-20260929`, 2026-09-29 09시 판정, 경량판): L2·L3·L4 가로·세로 합필 집 변형 18장(c·d·e, 초가·기와·돌판)과 변형별 낡음·새로 지음·눈·판자 오버레이 72장, 확인 그림 2장(JPG) `confirmed`. 마스크 43장·기록 그림 6장은 `records/`에 두고 `confirmed`. README: 첨부 화면에서 가장 크게 반복되는 붉은 박공·흰 받침 건물은 곡창(`barn.png`)이라 이번 후보가 곡창 반복을 해결하지 않는다.
- **Wave 31 장 시작 그림**(`wave31/candidates-20260929`, 2026-09-29 09시 판정): 3장(1348 흑사병의 예감)·4장(1362 재편)·5장(1400 자치와 유산) 시작 그림 1920×1080 JPG 3장과 1~5장 비교 그림(3200×360 JPG) 1장 `confirmed`. 생성 원본 약 1672×941을 확대·중앙 크롭한 판(네이티브 1920 아님). 비교 그림의 1장은 Wave 8 `keyart_title_bg`, 2장은 Wave 16 `chapter2_intro`.
- **Wave 32 곡창**(`wave32/candidates-20260929`, 2026-09-29 09시 판정, 경량판): 기본형 3(a 받침돌 목조·초가, b 다른 목골조·평기와, c 석조·부벽·돌판)과 상태 그림 18(가득·절반·빔·낡음·눈·빈집 판자, 160×144 피벗 (80,128), 현재 `barn.png`와 같은 규격), 분리 소품 5(도르래 보·밧줄 갈고리·낱자루·자루 더미 2). 24장 `confirmed`, `granary_b_snow-v1` `rework_pending`(비고 "눈이 흰 기와로 보임"), `granary_b_boarded-v1` `rework_pending`(비고 "판자가 안 보임"). 확인 그림 2(JPG)·마스크 9 `confirmed`.
- **Wave 33 막간 사건 삽화**(`wave33/candidates-20260929`, 2026-09-29 13시 판정, 경량판): 960×540 삽화 5장(1391 양모 집산지 이전, 1394 길드와 상인의 다툼, 1394 장터 국소 화재, 1396 교회 신랑 증축, 1399 헨리 4세 즉위 소식)과 확인판 1장(JPG) `confirmed`. 1399 왕실 깃발은 프랑스(백합 흩뿌림)·잉글랜드(사자 셋) 4분할(1406 이후 세 백합판과 구별).
- **Wave 32 곡창 재작업**(`wave32/rework-20260929`, 2026-09-29 20시 판정): B 눈(기와 줄눈을 덮는 불규칙한 눈 더미)·B 판자(문을 가로지르는 X자) 새 2장 `confirmed`, 비고 "재작업판(바이트 다름)" — 파일 이름이 원래 납품과 같다. 옛 2장(`rework_pending`)은 `superseded`, `replaced_by`에 새 경로. 비교판 1(JPG, 확인 그림)·새 마스크 1 `confirmed`. 나머지 24장은 원래 납품과 바이트가 같아 새 행을 만들지 않았다.
- **Wave 34 여울·습지 배수**(`wave34/candidates-20260929`, 2026-09-29 20시 판정): 여울 12(폭 2·3·4 × ne·nw × 여름·겨울, 512×256), 배수 1·2단계 4와 완료 도랑 띠 2, 소품 6(흙수레·널다리·수문·흙더미·물튀김 2), 확인 그림 2 = 26장 `confirmed`. `drain_stage3_drying_summer-v1`·`_winter-v1` 2장은 `rework_pending`(비고 "무늬 없는 갈색 판 — 진흙·그루터기·웅덩이 자국 필요").
- **Wave 34 배수 3단계 구역판**(`wave34/stage3-regions-20260929`, 2026-09-29 23시 판정): 칸 반복 대신 구역 한 장으로 다시 그린 `drain_stage3_drying_{summer,winter}_{5x5,3x3}-v3` 4장(5×5 640×320 피벗 (320,160), 3×3 384×192 피벗 (192,96), 반복하지 않음)과 단계 1→2→3→완료 비교 그림 1장 `confirmed`, 비고 "칸 반복 대신 구역 한 장(5×5·3×3)". 옛 칸판 2장(`drain_stage3_drying_summer-v1`·`_winter-v1`, `rework_pending`)은 `superseded`, `replaced_by`에 같은 계절의 5×5판과 3×3판 두 경로. 중간 v2 두 장은 받지 않아 행이 없다.
- **Wave 35 영주 모드 화면 그림**(`wave35/candidates-20260930`, 2026-09-30 11시 판정, 경량판): PNG 50장 — 의뢰서 기본 43(영지 9·협상 10·약속 8·운영 12·영수증 4), 직책 32px 파생 5, 9-slice 조립 보조 2(`treaty_divider` 협상 중앙선 16px·`ledger_spine` 장부 접힘 24px, 배경만 늘리고 중앙 장식은 늘리지 않음) — 과 확인 그림 2(JPG, 1280×800 모의 화면) `confirmed`. 검수·기록 그림 5장(`records/qa/` 4, `records/` 1)도 `confirmed`. README 한계: 쇠락 영지가 가난한 영지보다 쇠락 표현이 완만하다.
- **Wave 36 조합형 집 키트 파일럿 — 실패 기록**(`experiments/wave36-building-kit-pilot-20260930`, 2026-09-30 12시 판정): 부품 24장 `rejected`, 비고 "조합형 파일럿 실패 — 눈가림 100%·어색 72/216, 윤곽 통일이 다양성을 없앰, 기록 보관". 독립 눈가림 판별 48/48(기준 ≤60%), 216 조합 중 72개 어색(기준 ≤5%), 자동 검사 열 가지 가운데 여럿 실패(`records/REPORT.md`). 확인 그림 3·눈가림 48채 시트·마스크 27·검수 그림 23은 기록 그림으로 `confirmed`. 216·210 조합 렌더 전체는 astra-raw에만 있다. `experiments/`는 설치 후보가 아닌 실험 자료를 두는 곳이다.
- **Wave 37 집 앞 직업·형편 표지**(`wave37/candidates-20260930`, 2026-09-30 13시 판정, 경량판): 직업 12종 × a·b 24장과 형편 표지 8장 가운데 28장 `confirmed`. `rework_pending` 4장 — `condition_prosperous_bench` "19세기 공원 벤치로 보임", `trade_carpenter_a` "보통 벤치와 같은 물건으로 읽힘", `trade_miller_a` "치즈로 읽힘", `trade_miller_b` "새 입주 수레 B와 같음". 확인 그림 3(JPG) `confirmed`. 판독 시험 그림 12·검수 그림 8·작업 접촉판 4는 기록 그림으로 `confirmed`. 1차 교정 이력(`records/rejected/r1/`) 4장은 Astra가 반려한 판이라 `rejected`로 두었다(기록 보관).
- **Wave 37 재작업**(`wave37/rework-v2`, 2026-09-30 14시 판정): 새 4장(`condition_prosperous_bench`·`trade_carpenter_a`·`trade_miller_a`·`trade_miller_b`) `confirmed`, 비고 "재작업판(바이트 다름)" — 파일 이름이 원래 납품과 같다. 옛 4장(`rework_pending`)은 `superseded`, `replaced_by`에 새 경로. 비교판 3(혼동 쌍 JPG·6배 확대 PNG 2)은 확인 그림, 판독 기록 `recognition.jpg`는 기록 그림으로 `confirmed`. 나머지 28장은 원본과 바이트가 같아 새 행을 만들지 않았다.
- **캠페인 결말·빈 영주관**(`endings-manors/candidates-20260930`, 2026-09-30 19시 판정): 결말 삽화 6장(1920×1080 JPG — 스스로 다스리는 도시·이름이 남은 가문·상인들의 기도처·가문의 도시·영주의 도시·순례자의 도시, 장부에 각각 한 행)과 `manor_house_a_empty-v1`(416×328, 피벗 (249,319)) `confirmed`. `manor_house_b_empty-v1`은 `rework_pending`(비고 "원본에 없는 짙은 외곽선"). 확인 그림 2(여섯 결말 비교 JPG·영주관 정렬 PNG) `confirmed`.
- **빈 영주관 B 재작업**(`endings-manors/manor-b-rework-20260930`, 2026-09-30 20시 판정): `manor_house_b_empty-v2`(416×328, 피벗 (251,319)) `confirmed` — 닫힌 덧창·문 빗장·마당 풀 영역만 원본 Wave 12 `manor_house_b-v1`에 합성하고 외곽 알파·나머지 RGBA는 원본과 같다. 옛 `manor_house_b_empty-v1`(`rework_pending`, 짙은 외곽선)은 `superseded`, `replaced_by`에 새 경로. 확인 그림 1(원본·빈 판·50% 겹침) `confirmed`.
- **Wave 39 날씨·낙엽 재료**(`wave39/candidates-20260930`, 2026-09-30 21시 판정): 에셋 58장(비 22·웅덩이·젖음 8·낙엽 12·눈 6·잔해 10)과 확인 그림 3(비 전후 비교·가을 수관과 길가 낙엽·입자 크기 비교) `confirmed`. 줌 1.0 타일 128×64 기준, 빗줄기 실제 높이 최대 10px(사람보다 작음). 비는 세계 좌표 입자로 화면 전체 격자에 반복하지 않고, 물 위 파문은 Wave 29를 재사용한다. 프레임·피벗·알파·속도는 `records/`의 CSV·manifest 기준(초기 권장값).
- **Wave 38 UI 조작 부품**(`wave38/candidates-20260930`, 2026-09-30 판정, Claude — 재조립한 인물 카드에서 버튼이 양피지 여백 위에 앉음 확인): 투명 PNG 40장(버튼 4종 × 4상태 16·기타 조작 24, 기본 버튼 128×40·아이콘 버튼 48×48, 9-slice 여백과 `text_safe`는 `records/assets.csv`) 가운데 35장과 확인 그림 2(전체 조작·인물 카드 비교) `confirmed`. 주 버튼 4장(`button_primary_*`)과 `tab_hover`는 재작업 요청(`rework_pending`)이었고 재작업판이 같은 날 함께 들어와 `superseded`, `replaced_by`에 새 경로.
- **Wave 38 재작업**(`wave38/rework-20261001`, 2026-10-01 판정): 새 5장 `confirmed`, 비고 "재작업판(바이트 다름)" — 파일 이름이 원래 납품과 같다. 주 버튼 4상태는 바탕을 짙은 oak로 바꿔 보조 버튼과 구분하고, `tab_hover`는 중앙 상대휘도 0.381로 `tab_selected`(0.727)보다 어둡게 했다. 128×40·알파·9-slice·`text_safe`는 원본 그대로(알파 변경 0픽셀). 확인 그림 2(전후 비교 JPG·Chrome 9-slice 렌더 PNG)도 `confirmed`. Astra 권장: 주 버튼 글자색은 밝은 양피지(#f1e4c6).
- **Wave 40 영주 모드 사건 삽화**(`wave40/candidates-20261001`, 2026-10-01 판정): 960×540 JPG 14장(혼인·상속 8 — 혼인 협상·교회 문 봉인·신부 도착·첫아이·처남 출생·옛 영주 병상·유언 변경 시도·상속 신서, 소송·점유 4 — 소송 제기·문서 대조·점유 거부·점유 인도, 후견 2 — 어린 영주와 후견인·후견 종료)과 모아보기 1장(`proofs/contact-sheet.jpg`, 제목은 이 그림에만 있음) `confirmed`. 장부에 각각 한 행. 13번은 검수에서 문서에 글자 비슷한 무늬가 있다고 지적받아 불필요한 문서를 지운 수정판이며, 수정 전 v1은 `revision-reference/`라 넣지 않았다(astra-raw에 있음). 게임 카드 연결·잘림·런타임 확인은 아직 안 함.
- **영주 화면 부품**(`lord-components/candidates-20261002`, 2026-10-02 판정): 인물 중심 영주 화면용 34종 PNG 40장 — 성격 특성 6(48×48·24×24 두 크기 = 12), 지역 지도 바탕 1600×1000 1(불투명, 가상의 잉글랜드 남부 고을, 글자·실제 지명 없음), 지도 거점 96×96 4(장원·시장도시·수도원·방앗간, 공통 하단 y=88), 깃발 받침 64×96 3(직할·위임·이웃, 문장 없는 빈 깃발, 피벗 (14,90)), 직책 40×40 5, 알림 32×32 4, 건강 32×32 3, 왼쪽 메뉴 40×40 8 — 과 확인 그림 3(JPEG: 실제 크기·부품 모아보기·지도 조립) `confirmed`. 규격·피벗은 `records/assets.csv`, 다음 화면 개정 방향(초상·화면)은 `records/NEXT_SCREEN_DIRECTION.md`. 게임 미설치, 클릭 영역·DPR·문장 합성은 미검증.
- **Wave 41 다시 그리기**(`wave41/candidates-20261002`, 2026-10-02 판정): 아트 감사(`docs/design/art-audit-20261002`) 항목 16개를 ART_BIBLE_v2로 다시 그린 PNG 29장(다리 받침 3·길드홀 연기·건초 6·과수 4·울타리 2·농가 4·닭·배고픈 줄·바위·발자국 2·인장 슬롯·실제 기호·통행 표식·타이틀 배경)과 비교판 14(JPEG) `confirmed`. 캔버스·alpha>0 경계는 원본과 같고 알파 전체도 연기 1장 외 같다. 원본 행 33개 `superseded`(`replaced_by`에 새 경로) — 원본 27장과, 같은 바이트로 두 곳에 있던 6장(다리 NE·건초 a·b·사과 c는 `wave4-pilot`·`wave4b`, 발자국 ne·nw는 `wave7` 원본·`rework-v1/original-assets`)의 둘째 행. 농가 4장의 원본 행은 C2PA `caBX`가 붙은 바이트(`wave4c`·`wave4e`). `rock`(`public/assets/terrain/rock.png`)과 `seal_slot`(`public/assets/ui/seal_slot.png`)은 inbox에 원본 행이 없어 새 행 비고에 원본 경로만. 예외 판정(L6 백작 가문 담비 허용 30장, 결말 3장 굴뚝 보존)은 `records/L6-decision.md`·`ending-chimney-decision.md`·`exception-manifest.json`, 이를 반영한 바이블 v2는 `docs/design/art-bible.md`. 게임 미설치.
- **Wave 41 추가분**(`wave41/additions-20261002`, 2026-10-02 판정): 숲 바닥↔풀밭 전이띠 2(`woodland_grass_edge_{summer,winter}-v1`, 512×64, X 반복, 피벗 (256,32), Y 양끝 8px 투명 + 안쪽 8px 페이드, Wave 22 boundary 규격)와 폭 1 여울 4(`ford_w1_{ne,nw}_{summer,winter}-v1`, 512×256, 피벗 (256,128), 수면 1칸·디딤돌 3, Wave 34 여울 규격, 좌우 반전으로 방향을 바꾸지 않음), 확인 그림 7(JPEG) `confirmed`. 통합본의 기존 29장은 앞 묶음과 바이트가 같아 새 행 없음. 게임 미설치, 수로 접합·수면 흐름·DPR 미검증.
## 7. 찾지 못한 것

| 항목 | 상태 |
|---|---|
| 채팅 첨부로만 받은 파일 | 이 Mac의 파일 시스템에서 찾을 수 없음. 위 목록에 없는 ZIP이 있으면 추가로 받아야 함 |

## 8. 이후 규칙

- 넣기 전에 SHA로 중복을 찾는다: 이번에 받는 묶음끼리, 그리고 이미 inbox에 있는 모든 Wave와. 같은 Wave 안의 같은 바이트는 넣지 않고, 다른 Wave와 같은 바이트면 넣기 전에 알린다.
- Astra 산출물은 도착하면 설치 여부와 관계없이 `assets-inbox/<wave>/<batch>/`에 보관하고 `INBOX_LEDGER.csv`에 행을 더한다. 판정이 오기 전에는 모두 `candidate`다. `sources/`·`raw/`·`references/`는 넣지 않는다.
- 같은 때 원본 ZIP과 `output/astra-*` 작업 폴더를 `~/feudal-lord-analysis/astra-raw/{zips,output}/`에 복사한다(저장소 밖, 재부팅 대비).
- 재작업본이 오면 원본 행은 `superseded` + `replaced_by`, 재작업본은 판정 전까지 `candidate`.
- 장부는 여러 세션이 고친다. 다시 생성하지 말고 해당 행만 고치거나 행을 더한다.
- 판정·재작업·설치가 바뀌면 장부 행의 `status`·`replaced_by`·`installed_by`만 고친다. 파일은 지우거나 덮어쓰지 않는다.
- 장부 행 수 = inbox 그림(PNG·JPG) 수를 유지한다. JPG 행은 Wave 24부터(판정이 따로 온 파생본).
- **큰 기계 기록은 astra-raw에만**(2026-09-30 사용자 규칙, Wave 39 다음 묶음부터): 기계가 만든 기록 파일(JSON·JSONL·CSV·TSV·TXT·LOG·XML 등)이 256KB(262,144바이트)를 넘으면 저장소에 넣지 않는다. 원본은 `~/feudal-lord-analysis/astra-raw/`(받은 ZIP과 작업 폴더)에만 두고, 저장소의 같은 자리에는 `<파일 이름>.astra-raw.txt` 안내 파일 하나를 둔다. 안내 파일은 한 줄: `<파일 이름> · <바이트> bytes · sha256 <64자> · <astra-raw 경로>`(ZIP 안이면 `zips/<ZIP>::<묶음 안 경로>`, 작업 폴더에도 있으면 그 경로를 `;`로 덧붙임).
  - 사람이 읽는 문서(README·REPORT·QA·PLAN 같은 `.md`, 갤러리 `index.html`)와 확인 그림은 크기와 관계없이 그대로 저장소에 둔다.
  - 이미 들어간 Wave 39 `records/proofs/placements.json`(약 60,000줄) 등 규칙 전의 파일은 그대로 둔다(사용자 판정).
  - QA 회차(`docs/qa/roundNN/`)에도 03회차부터 같은 규칙을 쓴다. 단 재현용 게임 저장(`repro/saves/`)은 크기와 관계없이 저장소에 두고, 압축되지 않은 저장은 gzip해서 넣는다. 자세한 것은 [`docs/qa/README.md`](qa/README.md) "한 회차에 넣는 것".
