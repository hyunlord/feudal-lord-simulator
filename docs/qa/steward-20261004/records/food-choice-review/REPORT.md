# R08 식량 목적지 선택 재실행 독립 감사

**PASS_RECORDED_INPUT_ORIGINAL_FUNCTION_REPLAY_ONLY**. 기록된 재구성 단계 입력에 원 exported 함수를 적용한 네 선택 반환값은 증거와 일치한다. 공식 advanceTick 내부에서 선택ID를 직접 관측한 결과는 아니다. 새 장기 미배급 원인을 확정하지 않는다.

## 계보와 실행

실행14파일, helper5파일, 소스1097파일의 SHA와 사전·사후 OK목록 전체 경로를 확인했다. 입력 stage.json은 R07 food-boundary-executed/result/stage.json과 bytes가 정확히 같다. 입력SHA `f5bc425b4c6a763e1beda92fbdb4547ee76bb783ac1e5486ccf55b13436a0203`이며 tick300001의 reconstructed_stage, officialPrefixIntercepted=false 계약을 유지한다.

동기화 직전 카운터 라벨 수정본의 현재 probe SHA `6f3c86cf4feb25d3498ba1099b81725e9e5761075d64c29ea589ad3f8988efb2`, artifact manifest SHA `10a189a687023294d6b17d5a50534179771ca63d702d8746ebc8702aa5d62562`가 부모의 실제 원격 해시 기록과 일치한다. 원격 현재 파일을 새로 조회하지 않았다. 공식 종료0/1.7초, helper33ms다.

probe는 roamingDemand.ts의 bestHouseDemand와 nextHouseDemandTile을 직접 import한다. 후보 정렬 알고리즘을 helper에 복제하지 않았다. servicePath만 기록 포트로 대체하고, 예상하지 않은 포트 메서드는 Proxy에서 실패한다. 실제 경로를 새로 탐색하지 않는다. 현재 소스에서 nextHouseDemandTile은 bestHouseDemand를 내부 호출하므로 직접 best4+next4, 소스상 내부best4를 합한 총best8이다. 내부4는 별도 런타임 intercept 카운터가 아니며 출력도 이를 source-derived로 구분한다. advanceTick은0이다.

## 604개 체크의 의미

604개는 서로 다른604상황을 시험한 수가 아니다. 전역8개+행별 고정44개+기록 경로92개를 두 exported 호출에서 각각 exists/정확한 인수/undefined아님으로 확인한552개다. 각 호출의 독립 cursor가 끝까지 소비되는지도 검사한다. null 경로는 합법적 반환으로 구별하며 undefinedResult=false를 null이 없다는 뜻으로 쓰지 않는다.

독립 검수는 체크 개수만 읽지 않았다. 원시 R07 단계에서 네 배급자 행을 다시 찾고, 각각24/24/22/22개 servicePath 인수·결과 SHA를 두 callback 시퀀스와 모두 대조했다. 집 인수가 해당 행의 **housesAfter**와 같은지, 선택된 집 반환경로가 원기록의 그 집 경로인지, 다음 칸이 실제 기록된 walkerAfter.path[1]과 같은지, 잔여거리40-before.tilesTravelled가 맞는지 확인했다. 입력 불변 체크는 네 행별 hash와 전체record/file hash이며 recursive freeze도 적용한다. 본 검수는 Ruby JSON/hash만 사용했고 TS/엔진을 재실행하거나 별도 정렬 알고리즘으로 런타임 결과를 꾸미지 않았다.

roamingStep.ts는 serviceHouses 이후 serviced.houses를 continueRoaming에 넘긴다. 그 함수는 tilesTravelled 증가 **전**의 잔여거리를 nextHouseDemandTile에 사용하고 이후1을 더한다. helper의 post-service houses 및 before.tilesTravelled 계약은 이 소스 순서와 맞고 네 기록 모두 roaming→roaming, 이동계수+1을 검사한다.

## 네 반환값

|배급자 식별 끝부분|원 함수 재실행 선택|선택 경로 간선|대상000023 간선 / 잔여거리|기록 다음 칸과 일치|
|---|---|---:|---|---|
|000036:299880|house-46-42-0|1|20 /28, 범위 안|예 (46,41)|
|000036:300000|construction-site-000018|7|20 /40, 범위 안|예 (48,33)|
|000067:299760|house-46-42-0|2|19 /16, 범위 밖|예 (47,41)|
|granary-42-37-0:300000|construction-site-000018|2|19 /40, 범위 안|예 (45,37)|

선택 집과 대상은 이 기록에서 모두 빵0이다. 현행 comparator는 meals→경로 길이→마지막 배급tick→ID 순으로 비교한다. 위 결과는 이 소스 의미와 모순되지 않는다. 대상의 범위 판정은 원본 함수가 계산한 capacity와 기록 경로에 대한 **소스 조건식 평가**이며, 공식 틱에서 그 분기를 직접 관측한 값이 아니다.

같은 다음 칸을 공유하는 기록 집은 각각1/24/5/22개다. 따라서 다음 칸 일치만으로 선택ID를 역추정하면 안 된다. 이번 선택ID의 근거는 기록 포트로 재실행한 원 bestHouseDemand 반환값이다. 첫 행이 우연히 한 집만 공유하더라도 공식 내부 선택 관측으로 승격하지 않는다.

## 채택 범위

네 기록에 한정해 원 선택함수가 어떤 집을 반환하는지와 기록된 이동의 정합은 확인했다. 공식 내부 prefix 동일성은 R07부터 미입증이며, 재구성 단계에서 나온 경로를 다시 쓰므로 새 실제 경로 탐색·전체게임 재현이 아니다. 한 순간의 더 가까운 빵0 집 선택과 한 행의 잔여거리 부족을 장기 기아·사망의 유일 원인, 불공정 고착, 알고리즘 결함으로 단정할 수 없다. 후속 원인 판단에는 시간에 따른 선택·배달·식사 변화 증거가 필요하다. 이번 검수에서는 확장 실행이나 코드 수정 없이 제한된 진단 증거로 채택한다.
