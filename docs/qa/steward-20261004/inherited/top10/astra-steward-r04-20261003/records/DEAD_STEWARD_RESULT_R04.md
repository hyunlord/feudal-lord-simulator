# A02 현행 재현 — 사망 청지기 선임

[실측/DGX] HEAD5fb1aeb, 공식 runner nice19, exit0, command5.8초. N04 seed2/chalk/full의1450/t600000 자연 저장을 사용했다. 입력 파일 SHA760f899b00d0864572bb12b8a20e50e76911b9d9186019130b7ca701e1149d20.

수정하지 않은 자연 상태에서 set_estate_oversight(estate-neighbour-3,steward,est-000021)를 실행하자1435년 사망한 인물이 alive=false인 채 candidate→serving으로 바뀌고 oversight.stewardId도 같은 ID가 됐다. h-051591의stewardship.oversight params.stewardId도 그 사망 인물이다. 기존 A02의 현행 코드 재현이며 새 결함으로 중복 계수하지 않는다.

감사 대기 상태를 합성한 명시 후임/자동 후임 두 경로도 같은 사망 인물을 선임했다. 자연 발생 감사나 UI 접근을 증명하지 않는다. 살아 있음만 true로 뒤집은3개 통제는 선택됐지만 사망자 선임 조건은 false였다. deathYear/deathCause를 유지한 통제이므로 역사적으로 일관된 생존 인물을 재현한 것은 아니다.

6경로 모두 현금291821d와 원장은 그대로였다. 직접 선임은 연대기1건, 감사 교체는2건 추가됐다. 12개 전후 저장의 decode/exactRoundTrip 로그가 모두 true이며 감독관은 저장 파일12개의 SHA와6개 원시 결과의 사망·serving·oversight 조건을 독립 대조했다. 저장기가 이를 받아들인다는 사실이 인물 불변식 통과를 뜻하지 않는다.

다음 틱의 경제 활동·봇 선택 빈도·화면·자연 감사 발생은 미검증이다. 후보 목록·명령 입구·감사 자동 후임에서 생존 여부를 일관되게 검사하는 방향은 엔진 담당 검토 대상이다. 엔진 코드는 변경하지 않았다. 원자료: dead-steward-executed/ 및 사전 검수·staged 스크립트.
