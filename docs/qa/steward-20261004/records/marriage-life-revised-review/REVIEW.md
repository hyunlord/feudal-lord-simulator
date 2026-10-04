# 혼인 후속 수정판 독립 재검수

**17개 조건부 초안 통과 / 출생3개 사실행 차단 유지.** 최초 지적2개는 각각 '오프라인 selector 구현 수정'과 '선언 계약 보완'으로 반영됐다. 둘을 동일한 실행 검증으로 합산하지 않는다.

1. schema gate: `select_candidate`가 CONTEXT.schema 검사를 먼저 수행하고 오류면 nil로 돌아간다. 정상166 fixture, schema negative114, 양성26개 각각에 추가 필드/추가 envelope를 주입한52회귀를 읽기 전용 재실행했다. 모두 통과했다. 처음 발견한 malformed context가 이제 후보를 선택하지 않는다. 이 결과는 제안 Ruby selector에 한정된다.
2. contested2개 사망/신원: willAllowedRoute.captureRule에 양쪽 후보 모두 oldLord 실재·계약 당시 bride-father ID·영지/신부/협상/rival 일치·실제 사망 증거 확인을 명시했다. 생존→사망 전이 또는 앞서 캡처된 정확한 불변 사망 기록을 허용하고, inheritance 직전·직후가 이미 죽어 있는 상태라면 그것만으로 신규 사망을 입증하지 않도록 했다. 누락/불일치/현재 생존자 역산은 unknown이다. 이 문맥 어댑터는 구현되지 않았다. 따라서 사망 guard는 **계약 검수 통과이며 실행 검증은 아니다.**

PROPOSAL의 원20개 additions는 구조상 완전히 같다. field 계약 중 바뀐 것은 willAllowedRoute.captureRule의 추가 설명뿐이며 FIELD_CONTRACTS와 일치한다. 출생3개 BLOCK_UNPROVEN_REMARRIAGE_FACTLINE도 원본과 동일하다. 새 사망 guard가 재혼 사실행 문제를 해결하지 않는다.

현재 소스8파일14구간·수정 manifest 일치. 최초 검수 기준650 사본과 현재 정본650 모두 SHA `7314050459321e78ea19257fd4376ff80ab803586b0adfdaf2dd8ee159666dbf`를 확인했다. 후보·정본·엔진·원본은 수정하지 않았다.

실제 캡처, 런타임 저장/복원, 역사 formatter/UI는 미검증이다. 엔진 설치를 문장 초안 납품의 추가 관문으로 삼지 않는다. 추가 graft 호출 없이 최초 검수와 동일한 source SHA를 재검증했다. 경량 Ruby만 사용했다.
