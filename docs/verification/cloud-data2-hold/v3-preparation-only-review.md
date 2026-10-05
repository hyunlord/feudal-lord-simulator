# CLOUD DATA2 v3 준비 독립 검토

**APPROVE_PREPARATION_ONLY — 차단 사항 없음. 실행 승인은 부모 별도 판단.**

- 후보 `66b8e1ef2d5e4e9ec8d610cc21c583fbfd56bf6b`, tracked clean. freeze `0cad800795fad49a26eed2fa78ccffaae26b8521d99fa13f6dc40af891d61bda` 실제 SHA 및 준비 명세의 모든 helper SHA 일치.
- `validation.mjs:75–96` 변경은 transform6 성분만 `expected[i]` 또는 정확한 `Math.fround(expected[i])` 허용. 임의 epsilon 없음. 기대값은 승인 view의 camera/zoom에서 계산하고 관측 행렬에서 역산하지 않는다. 유효 행렬만 기대 표현으로 정규화하며 URL/source crop/destination/alpha .12/multiply/512×256/clock/행 집합은 그대로 exact 비교한다. 음성의 빈 expected trace에 새 draw를 허용하지 않는다.
- 실제 v2 first/repeat 20 trace 집합이 이 독립 기대값으로 설명됨을 재실행했다. v2 실패를 PASS로 재작성하지 않는다. scale/translation/shear 각 성분의 1e-10 변형, 비유한/잘못된 길이, crop/destination/alpha/blend 변형을 거부한다. strict descriptor/common semantic identity, frozen first/repeat paint delta, A/A 및 음성 검사도 유지.
- 준비 시험 실제 **23/23 PASS, fail0/skip0**: driver17 + guard6. 실제 product stage own-wrapper late bypass/early observer 회귀 포함. full local guard가 tracked26,887/input27,518/LFS6,384 및 self-SHA를 확인하고 잘못된 freeze SHA는 거부했다. 원격 wrapper의 실제 HEAD/clean/mirror ref/export census/prepost/external cache 경계는 기존 v2와 경로 변경 외 동일.
- v2 freeze의 기존 27,342 입력 바이트 전부 보존. 실패 원본 v1 75 + v2 75 파일 SHA 전부 일치. 기존 상태/관측기 보존; 제품 변경 없음.

이 판정은 보정된 검증기의 준비 승인이다. 실제 v3 제출/캡처, native 가독성·움직임, 성능은 증명하지 않았다. v1/v2 실패 기록을 유지하고 실제 실행은 별도 단일 실행 승인 뒤 수행해야 한다. 리뷰어는 원격/DGX/제품 수정 없이 검토 MD/JSON만 작성했다.
