# 나이 문맥 연대기 문장 확장 제안

629개 canonical과 별개인20개 후보,6개 사건종이다. 후보를629개에 더해 현재 엔진 호환 문장649개라고 보고하지 않는다. 새 context adapter와 slot/schema 연결이 필요하며 게임에는 설치하지 않았다.

## 산출물

- ADDITIONS.json: 사건종별 후보, context 조건, ageAtRecord 슬롯, 기존 사실선 유지.
- PROPOSAL.schema.json: 이 확장안의 별도 형식. 현재 canonical schema가 새context조건을 거부함을 검사했다.
- NATURAL_SAMPLES.json: N04 seed2chalk1450의 retained history에서 후보별 대표기록과 렌더 결과20개. 인물 이름을 고정하지 않고 ID만 근거로 보존한다.
- FIXTURE_RESULTS.json: 경계값·누락·중복·가구 사건69개 검사.
- VALIDATION.json: 스키마·조건타입46개·검사수와 미설치 경계.

## 재현

`ruby verify.rb` 후 `ruby schema_check.rb`. 첫 명령은 나이 adapter→조건선택→슬롯렌더링을 오프라인에서 확인한다. 둘째 명령은 별도 제안schema를 검사한다. verify.rb만 실행한 직후에는 fullSchemaValidation=false이며 schema_check.rb 완료 후true가 된다. 생성기 build.rb는 최종canonicalSHA를 다시 고정하므로 재현에 필수 실행 단계가 아니다.

## 문구 원칙과 한계

어린이/청년/성인/노년 구간은 게임의14/30/55세 기준이며 중세 법적 지위를 뜻하지 않는다. 출력의 나이도 생일이 없는 엔진의 연도 차이다. 현재 나이·직업·친족·생존 상태를 과거 기록에 덧씌우지 않는다. 출생 첫해의0살 표시도 엔진 나이이며 임상적 생후 기간을 뜻하지 않는다.

부상 출발은14–60세, 순례 출발은18–60세라는 생산기 조건을 반영했다. 부상/순례 및 그 종료에 어린이 분기를 만들지 않았다. 종료 기록에 현재 부상·순례 상태를 요구하지 않는다. 같은 해의 사망 전후 순서는 이 나이 계산으로 증명할 수 없다.

모든 후보는 기존 history.summary 사실선과 읽을 때 이름 치환을 유지한다. context가unknown이거나 슬롯이 빠졌으면 headline을 억지로 채우지 않고 baseline만 쓴다. 각20개가 기존 저장 기록에서 매치했지만 모든seed·모든시대·손상저장·실제UI의 전수 검증은 아니다. 이는 엔진 실행 없이 제안 adapter와 제안 formatter를 실행한 검사다.

근거: src/engine/persons.ts:821–849, src/engine/history.ts:388–428. 이전 나이 계약의 historyDate/4pool/생년 증거는 ../historical-age-adapter-proposal/SOURCES.json에 있다.
