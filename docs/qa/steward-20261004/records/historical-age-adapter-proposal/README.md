# 기록 당시 나이 읽기 어댑터 실행 가능한 제안

엔진 설치물이 아닌 오프라인 Ruby 참조 구현이다. 앞선 historical-age-contract/CONTRACT.md의 규칙을 실행 가능한 형태로 만들었다. 원본 저장·사람·역사 record를 변경하지 않는다.

재현: `ruby verify.rb`. 45개 경계/거부/보존 사례와 기존 N04 저장2기록을 검사한다. engine decode나 실제 formatter 실행은 하지 않는다. 사람 이름은 출력하지 않고 기존 FIX-12 읽기 경로를 유지한다.

## 입력과 출력

`HistoricalAgeProposal.read(historyRecord, snapshot)`.

성공 예: `{status:"known",eventYear:1448,subjectAgeAtRecord:66,subjectAgeBandAtRecord:"elder"}`.
실패 예: `{status:"unknown",reason:"household_event"}`. unknown은0세나 현재 나이로 대체하지 않는다.

제안 selector 연결은 별도 `context.subjectAgeAtRecord`와 `context.subjectAgeBandAtRecord`다. 아직 canonical conditionSources/schema에 추가하지 않았으며 실제 엔진에 연결되지 않았다. 엔진 담당이 구현할 때 historyDate/ageBandOf 정본을 호출하고, 이 Ruby의 상수를 게임 쪽에 중복 복사하지 않는다. 알 수 없는 context는 모든 나이 조건을 불일치 처리해 기존 사실선으로 돌아간다.

## 적용 경계

- 개인 사건17종만 허용한다. 가구 사건16종은 subject가 person이어도 거부한다.
- 네 인물 pool에서 ID가 정확히 하나일 때만 계산한다. 현재 역할·직업·혼인·관계·생존 상태는 과거의 근거가 아니다.
- 현재 검증한 scenario는 campaign_market_town 하나다. 다른 scenario를1300으로 추정하지 않는다. 새 scenario는 정본 startYear 검토 후 별도로 추가해야 한다.
- 생년·틱은 정수만 허용한다. 음수 나이·미래 기록·사망연도 이후 기록·중복 ID·손상 pool은unknown이다. died의 저장 age와 계산값이 다르면unknown이다.
- 사망연도만 있으므로 같은 해 안의 사망 전후 순서는 판별하지 않는다. 이 계산은 기록의 생전 실행 정당성을 인증하지 않는다.
- 나이구간14/30/55는 게임 정의이며 중세 법적 연령 주장으로 쓰지 않는다. born/came_of_age에 불가능한 나이 분기를 만들어 수를 늘리지 않는다.

## 확인 결과

N04 h-050888(1448년 fell_ill)은66세, h-051206(1449년 came_of_age)은14세다. 저장 시점 biography 헤더 나이와 분리했다. 검사에서 입력 JSON이 변하지 않음을 확인했다. 자연 기록2개 확인은17종 전수·150년 전체 보존·실제 UI 출력을 증명하지 않는다.

후속 작업은 이 제안을 사용하는 별도 문장 후보와 schema 확장안이다. 현재629개 canonical은 그대로 두었다.
