# fixed-context-revised 독립 재검수

**DRAFT PASS — 4유형 10문구. 이전 성장 2문구 capture 계약 지적 해소.** 실제 엔진 snapshot 구현·통합·UI 검증 합격을 뜻하지 않는다.

## 수정 확인

parent_context는 부모 두 ID가 비어 있지 않고 서로 다르며 subject 자신이 아닌지 확인한다. people/past 합쳐 각 부모가 정확히 한 번 조회되는지, alive가 boolean이고 householdId가 비어 있지 않은지도 확인한다. 동거 양성은 현재 people 소속 + alive=true + leftYear 키 없음 + 동일 householdId가 모두 필요하다. subject도 현재 people에 유일하게 있으며 생존·미이주여야 한다.

원래 반례(과거 이주한 살아 있는 어머니의 예전 householdId가 아이와 같음)를 실제 새 참조함수에 넣어 not_co_resident임을 확인했다. 현재 동거 어머니는 co_resident가 된다. subject 누락/중복, 부모 자기참조/중복, 잘못된 alive/빈 householdId, 잘못된 배열/subject 입력은 모두 unknown이다. 추가 독립12사례 통과.

이 함수는 동거 하위 판정 참조일 뿐이다. 발생 당시 snapshot의 유효성·캠페인 결합·나이 경계·before/after 동일 인물 확인은 FIELD_CONTRACTS가 요구하는 상위 어댑터에 남아 있다. 미래 구현은 이 참조함수 호출만으로 전체 capture 검증을 완료했다고 하면 안 된다. 다른 무관한 사람 데이터 전체를 검증하는 SaveCodec 대체도 아니다.

## 문구와 보류

원10개 addition 객체는 원본과 완전히 동일하며 ADOPTION_LIMITS도 바이트 동일하다. 성장2·석벽3·사제2의 7조합 보류 유지. 석벽 completed와 석재 교체 완료, 사제 공석과 실제 사망을 구분하는 원고가 유지됐다. ledger.l4 원시 증감3은 실제 archive 식별 전 채택하지 않는 제한을 유지한다. 정본650개에 10개를 합산하지 않는다.

## 재현

- selector130(정상10/폴백120), schema음성140, archive원시값음성10.
- 저자 부모 참조함수14 + 독립 부모12 + 별도 selector경계40.
- 최신 source10파일/20구간 SHA와 원문 일치(이전9/18에서 persons.ts가 추가됨).
- 후보 manifest21개 검증, 실행 전후 후보 파일 SHA 불변.
- 정본 SHA7314050459321e78ea19257fd4376ff80ab803586b0adfdaf2dd8ee159666dbf 유지.

경량 Ruby 검사이며 실제 자연 snapshot·저장복원·포매터·화면 검증은 하지 않았다. 후보·정본·엔진을 수정하지 않았다. 이전 source 검토를 재사용하고 이번엔 추가 source를 해시/구간으로 검증했다. 새 graft 호출0회.
