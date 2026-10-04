# R08 식량 선택 — 보존 입력 네 건 원함수 재실행 준비

준비만 완료. Mac에서는 node --check/bash -n/정적 JSON·SHA 확인만 했다. 엔진·브라우저·원격 실행 없음. 새 의존성 없음. source/기존 증거 변경 없음.

## 입력 및 엄격한 경계

HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742`. R07 재구성 stage.json SHA `f5bc425b4c6a763e1beda92fbdb4547ee76bb783ac1e5486ccf55b13436a0203`를 그대로 복사했다. 원본은 output/steward-food-boundary-r07/result/stage.json. 원래 자연 저장tick300000에서 재구성된300001 서비스 결정4건이며 공식 tick 내부를 직접 가로챈 입력이 아니다.

직접 호출은 bestHouseDemand4회 + nextHouseDemandTile4회, advanceTick0회. nextHouseDemandTile이 내부적으로 bestHouseDemand를 부르는 것은 원 코드의 정상 동작이다(따라서 내부 호출까지 세면 bestHouseDemand8회). summary.directExportCalls는 helper의 직접 호출 수다. 추가 후보 정렬 구현, 경로탐색, RNG 호출, 경제 명령, tick 전진 없음.

대상 servicePath가 존재하는 walkerIDs를 정확히 네 개·기존 순서로 고정한다. 각 입력은 housesAfter, 실제 servicePath의 current/house/path, before.tilesTravelled로 구성한다. remainingRange는 다음 칸 선택 후 이미 증가한 after값이 아니라 40−before값이다.

각 원 함수에 독립 cursor를 가진 recorded-input route adapter를 제공한다. 함수가 요구하는 콜백 인수 배열 [start,house]의 정확 JSON·순서를 보존 호출과 비교하고 보존된 경로를 그대로 반환한다. 누락·추가·순서 불일치·예상 밖 포트 메서드 접근·정의되지 않은 반환은 즉시 실패한다. 두 호출 뒤 모든 보존콜백 소비 및 동일호출열을 확인한다. 네 건의 기존 경로 호출수는24/24/22/22이며 각 원 함수 재실행에서 동일해야 한다.

전체 입력을 deep-freeze하고 각 건/전체 입력 JSON hash 및 원파일 SHA 불변을 검사한다. 공식 source의 capacity함수를 사용해 대상 문턱값을 표시하되 이를 source predicate evaluation이라고 명시한다. 원함수의 chosen house/path/meals 반환과 nextHouseDemandTile 반환, 보존된 walkerAfter.nextTile을 각각 기록한다. nextTile이 같아도 원실행 선택ID 직접관측 증거가 아니며 같은 다음 칸을 가진 집 목록도 따로 표시한다.

결과 선택ID는 **원 exported 함수를 보존된 재구성 입력으로 재실행한 반환값**이다. 실제 live route 결과·공식 틱의 실측 선택·미배급 원인 확정으로 승격하지 않는다. 모든 비교가 통과해도 status는 PASS_RECORDED_INPUT_FUNCTION_REPLAY_ONLY다. 일치 실패는 새로운 엔진 결함이 아니라 입력계약/재현 공백으로 먼저 분류한다.

## 부모 공식 실행

output/steward-food-choice-r08 전체를 동일 HEAD 공식 runner checkout에 동기화한다. Linux, /home/hyunlord/fls-runs/, FLS_REMOTE_PORT, HEAD guard가 있으며 result/는 없어야 한다.

```sh
scripts/remote/run.sh steward-food-choice-r08 --detach --keep -- bash output/steward-food-choice-r08/run.sh
```

runner 내부 nice19, timeout60초 + TERM grace5초. engine source·input·helper artifact SHA 사전/사후 검증. 브라우저/서버/배경 작업 없음. exit.txt/cleanup.txt 및 source/artifact-before/after.log를 남긴다. SIGKILL·호스트 장애는 cleanup 보장 밖이다.

출력: result/choices.json(선택ID·콜백열·문턱·다음칸), scope.json(증거등급), summary.json(직접호출수·검사), 실패시 error.json. 입력정보가 부족하면 실패하며 확대실행하지 않는다. codec/공식 tick/전체게임 재현 검증은 이 helper 범위에 없다.
