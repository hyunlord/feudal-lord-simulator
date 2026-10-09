# 140: 직접 감독 답에서 실제 다음 철 청원으로

공식 light/keep 실행 `engineB-tlink-140-browser-admission-ce4ea9a`, source `ce4ea9af6454ad557a7df6ad385a45b7e1ec0232` (제품0b04), exit0. 당시 dirty는 인계 문서와 시험 증거뿐이다.

실제 reducer의 140:b 답 `h-000011` (tick1004) 뒤 실제 `advanceStewardship`이 만든 수리 청원 `estate-petition-2`와 기존 `stewardship.brought` 기록 `h-000015` (tick2000)을 사용했다. 인과 주석 전후 ordinal은28로 같고 `part=true`를 보존했다. 저장 codec 왕복과 브라우저 진입 후 tick 불변을 확인했다.

정상 챕터 화면의 ‘전체 연대기 보기’ 버튼 → 자기 답 → 가을 청원 → 원인 답으로 돌아가기까지 실제 클릭했다. 이미지2장을 직접 검토했고 즉시 처리와 다음 철 청원이 각각 표시된다. 빈 예측/실제 열과 일부 한글 단어 분리는 기존 화면 한계로 남는다. 준비한 계절 경계 사례이며 자연125년 판이나80% 결과가 아니다.

`result.json`에 원본 driver·저장 gzip·이미지의 SHA256과 byte 수, 압축 전 저장 SHA256, 정확한 기록을 보존했다. 원본 driver는 저장소 루트의 바로 아래 디렉터리를 기준으로 한 상대 import를 포함한다. 재현할 때 `.remote/tlink-140-capture.mjs`로 복사하고 공식 원격 실행기의 Linux 환경·`TLINK_URL`을 사용한다.

첫 실행 `engineB-tlink-140-browser-ce4ea9a`는 챕터 종료 화면에서 C 단축키로 연대기를 열려고 하여 exit1이었다. 상태나 제품을 고치지 않고 정상 버튼을 처리하도록 driver만 보정했다. `first-attempt-*`가 그 실패의 원본이며 통과 증거로 사용하지 않는다.
