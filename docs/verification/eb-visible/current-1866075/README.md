# EB 현재 화면 캡처: 1866075

상태: 실제 브라우저 기능 증거와 독립 검토 보관. **시각적 판정 REVISE**: 빈 예측/실제 비교 영역과 CJK 줄 나눔이 남는다. 상세 범위와 근거는 `visual-review.md`, 기능 검토는 `functional-review.md`에 보존했다.

렌더 소스 `18660752adef3d7632e9aac3a6b211f6a7e0e549`, dirtyPaths 빈 값. 입력은 seed 1의 기존 125년 체크포인트이며 원래 엔진 소스는 `2485af40046793f1856829fa1161dc4431942aa7`이다. 두 소스는 서로 다르므로 원본 당시 화면의 재현으로 부르지 않는다. 1280×800, `run: false`; 시뮬레이션을 재개하지 않았다.

원격 실행 `render-EB-visible-current-1866075`: 종료 코드 0, 준비 7.4초, 대기 0초, 명령 443.1초(동기화 25.8초). 원본 체크포인트 폴더와 파일별 압축/인코딩 해시는 `source-manifest.json.gz`에 그대로 보존했다. 원본 manifest SHA-256은 `e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d`이다.

## results.json의 기능 관측

- 총 31개 경우, 기록된 오류 0. 모든 경우에서 초기/종료 history·trace 동일, tick 불변, 캡처 도중 presentation 불변: 각각 31/31.
- 예상 `withResidentWalkers` presentation과 초기/종료 완전 일치는 30/31. `ck_evt_038-answer`만 `/seen`이 추가되어 불일치한다. 원시 저장과 presentation의 완전 일치는 0/31이므로 “원시 GameState 완전 동일”이라고 주장하지 않는다.
- 수동 연대기 열기 및 정확한 결정 찾기: 결정 대상 30/30. 나머지 1개는 `final-year-review`이다.
- 정확한 결과 링크와 원인으로 돌아가는 링크: consequence 경우 각각 13/13. 결과 링크가 없는 17개 결정 화면을 새 인과 연결로 세지 않는다.
- 초기 chip 표시 16/31. chip을 통한 선택 기록이 기대 결정과 일치한 것은 8/16이며 나머지 8개는 다른 기록을 선택했다. chip 존재를 해당 결정으로 가는 정확한 링크 성공으로 환산하지 않는다.
- `automaticYearReview`는 0/31이다. 이 결과는 정지 저장을 로드하고 정상 UI로 이동한 관측이며 첫 계절 자동 노출, 새 계절 보고 알림 또는 자연 플레이 중 가시성을 증명하지 않는다.

chip 대상 불일치: `ck_evt_005-consequence`, `ck_evt_092-consequence`, `ck_evt_140-answer`, `ck_evt_032-answer`, `ck_evt_032-consequence`, `ck_evt_042-answer`, `ck_evt_042-consequence`, `ck_evt_031-consequence`.

## 파일과 재검증

`results.json.gz`와 `source-manifest.json.gz`는 원본 바이트를 결정론적 gzip(mtime=0)으로 보관한다. `artifact-manifest.json`은 원격 산출물 전체 139개(스크린샷 137개 포함)의 상대 경로·바이트 수·SHA-256, 보관 gzip과 압축 해제 원본의 해시를 담는다. `SHA256SUMS`는 이 디렉터리의 일곱 산출물 해시다.

스크린샷은 이 폴더에 복제하지 않았다. 로컬 원본은 `.remote-runs/render-EB-visible-current-1866075/eb-visible-current`, 원격 원본은 `/home/hyunlord/fls-runs/render-EB-visible-current-1866075/.remote/eb-visible-current`에 있다. 이 경로는 보관 위치를 나타내며 추후 원격 정리에도 영구 존속함을 보장하지 않는다. 전체 결과와 source manifest는 이 작은 저장소 보관본만으로 복원할 수 있다.

압축 바이트 동일성과 전체 원본 파일 해시/크기를 보관 시 재검증했다. 시각적 잘림·읽기 쉬움·화면 품질은 별도 보관한 독립 검토 결과의 범위로 한정한다. 이번 31개는 같은 seed 1의 선택된 체크포인트이며 독립 seed 수, all56 노출 완결, 자연 이벤트 빈도 검증으로 확대하지 않는다.

`image-diff-diagnostic.json`은 부모 검토자가 실행한 동일 사례의 이전/현재 PNG 6쌍 비교 원본이다. 모두 1280×800이며 alpha 손상이 없다는 기계 검사다. 승인된 픽셀 기준선이 없고 UI 소스와 탐색/필터가 달라 수치는 진단용이며 시각적 통과 판정이 아니다. 별도 이미지 검토 결론을 이 수치로 대체하지 않는다.
