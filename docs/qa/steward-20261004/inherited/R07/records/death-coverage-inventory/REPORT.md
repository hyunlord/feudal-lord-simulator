# A 사망 자료 보존 범위 — 자연 150년 세 판

**기존 자료만으로 세 판의 `persons.past`에 기록된 사망자 ID·연도·원인은 150년 범위에서 복원할 근거가 충분하다.** 최종 저장 하나를 무조건 전체 총계로 부른 결론이 아니다. 시작·25년 간격 체크포인트와 연말450개 누계를 대조했다. 모든 중간 사망 ID·연도·원인이 최종에 보존되고, 최종 deathYear로 다시 만든 원인별 누계가 연말 관측450개와 전부 일치했다. 사망자 보존 상한·삭제 규칙은 현재 producer에서 찾지 못했다.

그러나 이는 **도시/영주관 인물 기록에 남은 원인별 사망**의 범위다. 세력·지도 밖 영지 인물 사망, 모든 사망의 정확tick, 실제 사망 당시 가구의 빵·구휼·경로 상태, 전체 인구수지나 사람으로 생성되지 않은 손실까지 완전 복원한다는 뜻은 아니다. 원인 라벨은 엔진이 기록한 값이며 역사적 인과 증명이 아니다.

|판|persons.past 사망|age|famine|famine_year|plague|fire|person.died 연대기|
|---|---:|---:|---:|---:|---:|---:|---:|
|N02-v3 growth|5440|3109|2059|13|257|2|3795|
|N03-v3 stability|2167|1739|98|14|313|3|1988|
|R03 N04 chalk full|3083|2349|293|13|422|6|2903|

각 판 ID는 독립 namespace다. 판 사이 같은 p-ID를 합쳐 한 사람으로 세지 않는다. 체크포인트 final/year1450 내용중복은 stateSHA로 제외했다. 상세 사망 ID·연도·원인·연대기tick은 `*-deaths.json`, 연말 검산은 `*-annual.json`, 입력SHA·최초 누락은 INVENTORY.json이다. 기간은 tick0~600000, 연말1301~1450의 직전연도1300~1449이다. N04 최초 사망연도1301은 초기 연말 누계와 일치하며1300 자료 유실이라는 증거가 아니다.

## 보존과 서로 다른 집계 계약

`persons.ts:190–203`은 people와 past를 복사해 돌려주며, `remove:218–239`는 죽은 인물을 alive:false/deathYear/deathCause와 함께 past 끝에 추가한다. 사망기록을 일정 수·기간으로 자르는 부분은 없다. past.splice는 상속 귀환 등의 **살아 있는 이주자**를 people로 옮기는 경로다(nearestBloodKin alive 조건 포함). observed checkpoint 사망 ID 소실0과 맞는다.

`persons.ts:962–967`은 떠났지만 살아 있는 past 인물도 늙어 사망시키며, 배열에 추가하지 않고 기존 항목을 alive:false/age/deathYear로 교체한다. leftYear는 이때 제거한다. 따라서 최종의 과거 householdId를 “사망 당시 도시 거주”로 단정할 수 없다.

반면 `history.ts:417–422`의 person.died는 새 past 꼬리와 before.people의 교집합을 다룬다. past 내부에서 사망한 이주자는 이 계약 밖이다. 실제 연대기 없는 사망은 N02 1645·N03 179·N04 180이고 모두 age다. 그중 앞선 체크포인트에서 **alive=true+leftYear가 있는 past 인물**을 직접 확인한 수는1368·147·132다. 나머지는25년 사이 이주·사망 가능성이 있지만 스냅샷만으로 전부 그 경로라고 단정하지 않는다. 독립 연대기 person.left_town도 이 대상들에 없으므로 그것을 증거로 만들어 쓰지 않았다.

가장 이른 person.died 부재: N02 p-000121/1304, N03 p-000197/1313, N04 p-000099/1305(모두age). **이는 persons 사망누계의 최초 공백이 아니라 개별 사망tick을 연대기로 복원하지 못하는 최초 사례**다. annual 누계 불일치/중간 사망ID 삭제는 세 판 모두0.

runner `probeMetrics.ts:22`의 retainedDeathsByCause는 그 시점 past의 !alive 분류다. `stewardProbe.ts:200–205`의 연간 historyTemplates는 yearStartTick ≤ record.tick < 현재연말tick의 기록 종류를 센다. ID ordinal에 따른 증분이나 모든 death producer의 event tap이 아니다. 최종 person.died 수와150개 annual person.died 합은 세 판 모두 일치한다. 두 합계 차이를 기록 삭제·엔진 사망 버그라고 선언하지 않는다.

## A 기근·흑사병에 지금 쓸 수 있는 것

세 판의 famine/famine_year/plague 사망자는 모두 해당 person.died 연대기와 연결됐다. 기존 최종 history는 첫tick부터 남아 있으므로 이 원인들에 한해서 ID·연도뿐 아니라 기록tick도 회수 가능하다. 따라서 **원인별 연간 사망 추이와 기록tick 분석만 필요하다면 새150년 실행이나 새 event tap은 필요 없다.** `famine`을 대기근 기간만의 사망이라고 제한해 읽어서는 안 된다. house decline에서 frail 사망도 famine이고, 시기별 실제 record를 필터해야 한다.

정확한 A 질문이 “구휼 여부/집 안 빵/가격부담 때문에 어느 집의 사망률이 얼마나 달라졌나”라면 현재 원인라벨과25년 간격 저장만으로는 인과 분모를 회복할 수 없다. 기존 기근·흑사병 도착/완료 기록과 해당 tick 사망을 먼저 정렬하고, 부족한 **짧은 사건 창의 before/after 인물·가구 상태와 사망 transition**만 별도 관측하는 것이 최소 단계다. 연대기만을 event tap으로 삼으면 이주 후 age 사망을 놓치는 계약도 유지해야 한다. 범위 정의 없이 새 전체150년 실행을 권하지 않는다.

## 한계

450개 연말 비교는 동일 계열 producer의 누계와 교차검산한 것이므로 물리 인구수지의 독립 증명은 아니다. 기록되지 않은 사망이나 년내 생성·삭제가 존재하지 않는다는 전 우주 보장은 하지 않는다. 지도 밖 인물은 factions/estates 별도 producer가 있어 이 총계에 섞지 않았다. 기타 시스템까지 포함한 전체 세계 사망을 요구하면 본 숫자는 하한이다.

기존 R06 장기 표면 요약을 먼저 읽었고, 이번에는 새 실행 없이 보존계약과 ID·연말 검산을 추가했다. 엔진/브라우저/원격 실행, 소스·기존 증거 수정 없음.
