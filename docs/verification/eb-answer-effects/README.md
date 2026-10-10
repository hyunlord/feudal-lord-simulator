# EB-ANSWER-EFFECTS 검증

관문: 요청 읽기·실제 전이 대조 통과. 실행 위치 Mac, fixture reducer 시험. 화면 연결/사람 플레이/새125년 측정/본선 병합 관문은 아니다.

- focused 163/163,0skip: 새 unit7 + 기존 TRACE-LINK 지정10사건 포함 + 저장 지문.
- renderer 재생1/1,0skip: 동일74답 + 역제안 승낙/거절2 =76답. 독립 전체상태 leaf walk가 값·부재·차이를 대조한다. 원래 렌더 시험에서 제외하던 혼인/사람/물리 공사/목책·예약도 포함한다. 처리 기록/캐시 제외는 helper의 명시 계약이다.
- 기준 `db750c16486a283e7f320ceaca70504589a00f93` reducer와 같은76전이를 짝 비교: trace 밖 **전체** 상태 완전 일치. history도 일치한다. 이 짝 비교는 장기 판 해시 관문을 대신하지 않는다.
- tsc, 변경src ESLint, diff whitespace 통과.
- `test:changed --base db750c164`: 612선정,127재사용, 추가482파일이 Mac30 한도를 넘어 실행 거부. 이 결과를 통과라고 세지 않는다. 공식 전체 회귀/기하 관문은 엔진 통합 때 수행한다.

## 입력·재현

렌더 참고 소스 `/Users/rexxa/github/fls-receipts2`, HEAD `299cffec123d869f629bd8c6e9537bd5be9d46e4`, `tests/answerReceipts.test.ts`. 기존 DGX `~/fls-lmr2-states`, `~/fls-lmr1-petition-states`, `~/fls-lord-states`, `~/fls-variant-states` 파일을 내려받았다. **새 자연판이 아니다.**45 JSON의 원격경로·크기·SHA256·수신시각은 fixture-provenance.json, 원본은 fixtures.tar.xz. 시험은 렌더와 같은 FOLDERS38개 중 실제 답을 가진 상태를 읽는다. 기타7개는 수신 원본 보존일 뿐 시험 수를 늘리지 않는다.

```sh
mkdir -p .omo/evidence/answer-effects/fixtures
 tar -xJf docs/verification/eb-answer-effects/fixtures.tar.xz -C .omo/evidence/answer-effects/fixtures
LMR2_STATES="$PWD/.omo/evidence/answer-effects/fixtures/lmr2" \
LMR1_PETITION_STATES="$PWD/.omo/evidence/answer-effects/fixtures/petitions" \
LORD_STATES="$PWD/.omo/evidence/answer-effects/fixtures/lord" \
VARIANT_STATES="$PWD/.omo/evidence/answer-effects/fixtures/variants" \
node --import tsx --test tests/answerEffectsReplay.test.ts
```

짝 비교는 기준db750c164의 별도 worktree에 node_modules를 준비하고 `ANSWER_EFFECTS_BASELINE=/absolute/baseline/src/state/gameStore.ts`를 같은 명령에 더한다. 기록 전체는 replay.json.gz. build-fixture.ts는 커밋된 v49 fixture와 실제 reducer만으로 provisional57 fixture를 재생성한다. 모양만 재인코딩한 가짜 effect 자료가 아니다.

P-C3/A4: 기대 명령이 아닌 실제 전이의 수치. P-C2/A5: 답ID 하나로 영수증·흔적·연대기 연결, 과거 미기록은 미기록. P-D2: 처리 상태만으로 효과를 만들지 않음. 기존 무효과는 그대로 빈목록이며 규칙은 이 작업에서 바꾸지 않았다.
