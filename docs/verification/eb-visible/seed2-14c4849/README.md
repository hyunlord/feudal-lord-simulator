# EB seed 2 화면 캡처: 14c4849

상태: 4개 사건(083, 046, 209, 204), 8개 저장 화면의 기능 증거 보관. **시각 판정 REVISE**는 부모 검토자가 직접 본 네 PNG의 범위이며, 빈 `예측과 실제` 영역 및 CJK 줄 나눔 문제를 남긴다. `visual-review.md`에 범위와 네 원본 이미지 해시를 보존했다. 독립 기능 검토는 `functional-review.md`에 보관한다.

렌더 소스 `14c4849d4e0cc2efde48abdfa99edb4f44e94910`, dirtyPaths 빈 값. 입력 seed 2의 원본 엔진 소스는 `2485af40046793f1856829fa1161dc4431942aa7`이다. 원본 당시 UI 재현이나 새 독립 캠페인으로 부르지 않는다. 1280×800, `run:false`; 시뮬레이션을 재개하지 않았다. 원격 실행 `render-EB-seed2-visible-14c4849`: 종료 0, 동기화 23.7초, 준비 7.3초, 대기 0초, 명령 120.4초.

입력 manifest SHA-256: `766a84d5db46f5a91777f885f11c0a249b3e84aec3169635216201efb1b3553e`. 전체 입력 manifest 원문을 압축 보관하며, 선택 8개만 캡처했으므로 그 manifest의 모든 항목을 화면 검증한 것은 아니다.

## results.json 기능 관측

- 오류 0, 정확한 결정 찾기 8/8. 초기·종료 history/trace 동일, tick 불변, 캡처 중 presentation 불변 각각 8/8.
- 예상 `withResidentWalkers` presentation과 초기·종료 완전 일치 각각 8/8. 원시 저장과 초기 presentation 일치는 0/8이므로 원시 GameState 전체 동일로 주장하지 않는다.
- 실제 결과 쌍은 083·204 두 건이며 정확한 결과 및 원인 복귀 링크 각각 2/2. 046·209 final-no-pair는 미래 연결을 새로 입증하지 않는다.
- 초기 chip 7/8, 기대 결정 선택 2/7(083 consequence, 209 answer), 다른 결정 선택 5/7. chip의 존재와 대상 일치를 구분한다.
- `automaticYearReview` 0/8. 정지 저장을 연 정상 UI 탐색이며 자연 첫 노출, 계절 자동 보고 또는 후보 빈도 증거가 아니다.

## 보관과 재검증

원본 `42`개 산출물(40 PNG 포함), 총 50077964바이트의 파일명·크기·SHA-256을 `artifact-manifest.json`에 모두 기록했다. PNG는 복제하지 않았다. `results.json.gz`, `source-manifest.json.gz`는 파일명 헤더 없이 mtime=0으로 결정론적 압축했다. 압축 해제 원문과 압축물 해시를 manifest에 함께 기록했다. `SHA256SUMS`는 자신을 제외한 이 디렉터리 모든 보관 파일의 해시다.

전체 이미지 원본의 로컬 경로는 `.remote-runs/render-EB-seed2-visible-14c4849/eb-visible-seed2`, 원격 경로는 `/home/hyunlord/fls-runs/_kept/render-EB-seed2-visible-14c4849/.remote/eb-visible-seed2`이다. 향후 원격 정리 이후 영구 존속은 보장하지 않는다. JSON 두 원문은 이 저장소 보관본으로 복원할 수 있다. 기능 검토와 제한된 시각 검토를 구분하며, seed 2의 선택된 4사건 결과를 all56 또는 역사적40 전체 가시성 완결로 확대하지 않는다.
