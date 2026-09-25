# 에셋 받은 편지함

Astra가 보낸 후보는 받는 즉시 `assets-inbox/<wave>/`에 LFS로 커밋한다(설치 여부와 무관, AGENTS 상시 규칙 17).
설치 작업은 여기서 꺼내 `public/assets/`로 옮기고 `docs/provenance/assets.csv`에 행을 둔다. 채택하지 않은 후보는
여기에 남기고 대장 상태를 `rejected`로 적는다. 이 폴더의 파일은 받은 바이트 그대로이며 고치지 않는다.

| wave | 받은 곳 | PNG | 대장 | 비고 |
|---|---|---:|---|---|
| `d1` | D1a 지시서 ZIP | 5 | `provenance-D1.csv`(7행, 확인 그림 2장은 받지 않음) | D1a가 설치 |
| `d1b` | D1a 지시서 ZIP | 2 | `provenance-D1b.csv`(4행, 확인 그림 2장은 받지 않음) | D1a가 설치 |
| `wave2` | V1 지시서 ZIP | 34 | `provenance-wave2.csv`(39행) | 31장 V1 설치, `hold/` 목축형 농장 3장은 보류(C5) |
| `wave4-pilot` | C1b 지시서 ZIP + D1a-2 추가 ZIP | 7 | `provenance-wave4.csv`(12행) | 나머지 파일럿 5장은 Wave 4b에서 `_a`로 승격돼 `wave4b/`에 있다 |
| `wave4b` | C1e 지시서 ZIP | 53 | `provenance-wave4b.csv`(53행) | C1e가 설치 |
| `wave4c` | C1f 지시서 ZIP(`to_ClaudeCode_C1f (2).zip`) | 18 | `provenance-wave4c.csv`(18행) | C1f가 설치. 받은 PNG에는 C2PA `caBX` 청크가 붙어 있어 대장 SHA와 다르다(IDAT 동일, `caBX`를 빼면 18/18 대장 SHA와 같음). 여기에는 받은 바이트를 그대로 두고, `public/assets/`에는 `caBX`를 뺀(대장과 같은) 바이트를 설치했다 |
| `wave4d` | D3b-2 지시서 ZIP | 22 | `provenance-wave4d.csv`(22행) | D3b-2가 설치(벽 띠 v2·코너 탑·깊은 물·물가 띠 e·f·갈대·돌·앞쪽 교대) |
| `wave5a` | V2 지시서 ZIP(`to_ClaudeCode_V2.zip`) | 61 | `provenance-wave5a.csv`(55행: 워커 29 · 소지품 24 · 겨울 외투 2) | V2가 워커 29·소지품 24·외투 2를 설치. `portraits/` 초상화 파일럿 6장은 대장 행 없이 인물 파일럿 기록용으로만 둔다(설치하지 않음). 받은 PNG 55/55가 대장 SHA와 같다(`caBX` 없음) |
| `wave4e` | INSTALL-4e 지시서 ZIP(`to_ClaudeCode_INSTALL4e (1).zip`) | 35 | `provenance-wave4e.csv`(35행) | INSTALL-4e가 설치(잡석 면·성문 v2·135° 기둥·탑 b·깊은 물 물가 띠·교대·나루·허들 조각·양·돼지·겨울 헛간·워커 7·상인 외투·소지품 2). 받은 PNG에 C2PA `caBX` 청크가 붙어 대장 SHA와 다르다(`caBX`를 빼면 35/35 같음). wave4c와 같이 여기에는 받은 바이트, `public/assets/`에는 `caBX`를 뺀 바이트 |
| `wave5b` | INSTALL-4e 지시서 ZIP(추가 절) | 15 | `provenance-wave5b.csv`(15행: 초상 레이어 12 `candidate` · 아이·노인 시트 3 `rejected`) | 설치 없음. `A/`의 아이·노인 자유 생성 시트는 보행 교대 실패로 `rejected`(`A/direction-consistency.md`), 대신 `derived-templates/`의 스크립트 파생 4장을 쓴다. `A/checks`·`B/checks` 확인 그림 6장은 대장 행 없이 둔다. 받은 PNG 15/15가 대장 SHA와 같다 |
| `derived-templates` | INSTALL-4e가 `scripts/deriveActorTemplates.ts`로 생성 | 4 | `provenance-derived-templates.csv` | 성인 시트에서 파생한 아이·노인 템플릿. Astra 재스킨용 참조, 게임에 설치하지 않음(Wave 5c) |

모든 PNG의 SHA-256이 같은 폴더 대장의 `runtimeSha256`과 같다. Wave 4b는 두 번 받았다
(`to_ClaudeCode_C1e.zip` 03:16, `to_ClaudeCode_C1e (1).zip` 08:47). 두 번째 ZIP의 PNG는 IDAT가 같고 C2PA
`caBX` 청크(약 5.7KB)만 더 붙어 있어 대장 SHA와 다르다. 여기에는 대장과 같은 첫 번째 ZIP의 바이트를 둔다.

INBOX-1(2026-09-26)부터 새 묶음은 `<wave>/<batch>/{assets,proofs,records}`에 두고, 모든 PNG의 상태는 [`INBOX_LEDGER.csv`](INBOX_LEDGER.csv)에 적는다. 구조·상태 뜻·찾는 법: [`docs/ASSET_INBOX.md`](../docs/ASSET_INBOX.md).
