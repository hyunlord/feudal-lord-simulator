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
| `wave4d` | D3b-2 지시서 ZIP | 22 | `provenance-wave4d.csv`(22행) | D3b-2가 설치(벽 띠 v2·코너 탑·깊은 물·물가 띠 e·f·갈대·돌·앞쪽 교대) |

모든 PNG의 SHA-256이 같은 폴더 대장의 `runtimeSha256`과 같다. Wave 4b는 두 번 받았다
(`to_ClaudeCode_C1e.zip` 03:16, `to_ClaudeCode_C1e (1).zip` 08:47). 두 번째 ZIP의 PNG는 IDAT가 같고 C2PA
`caBX` 청크(약 5.7KB)만 더 붙어 있어 대장 SHA와 다르다. 여기에는 대장과 같은 첫 번째 ZIP의 바이트를 둔다.
