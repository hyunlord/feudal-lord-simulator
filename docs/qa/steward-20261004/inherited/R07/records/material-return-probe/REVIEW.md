# R07 취소 화물 반환 경계 결과

판정: PASS_SCOPED_RETURN_BOUNDARY. HEAD5fb1aeb, R06 자연 진행의 seed1 반환 직전4저장 사용. 146검사 실패0. 공식 advanceTick 총8회(각 입력2회)와 재구성한 운반 단계 검사는 구분한다.

- 기존 취소 화물 목재16·돌12는 각 귀환 단계에서 목적지 재고에 전량 입금됐다. 빈 귀환자1명은 입금량에 더하지 않았다.
- 정렬된 singleton stepCarters 합성 결과가 전체 stepCarters 결과와 일치했다. 전체 tick 내부에 계측기를 삽입한 검사가 아니다.
- 공식 tick 이후 저장4개가 R06의 각각 대응 저장과 바이트 동일하며 helper 원격/로컬/result SHA도 동일하다. 실제 실행 helper는 bfc8a7816a2a4ce8605e9d9db66f95f3d9c4279c571557411a38caca98b892fb.
- releaseSpace wrapper 관측5개는 화물 입금 뒤 공간 예약 해제의 보조 관측이다. 직접 deposit hook으로 과장하지 않는다.
- 6개 귀환 경계의 overflow는 모두0. 공간 초과 분기를 강제로 만들지 않았으며 그 경우는 미검증이다.
- 환급·소실의 영속 상세 원장 공백이 해결된 것은 아니다. 전기간·전 자원의 생성/소비/무역 보존도 별개다.

공식 DGX runner nice19, command3.5초 exit0. unit fls-run-astra-steward-material-return-r07-5fb1aeb-1791066510.scope inactive/dead/not-found, runner PID1791840 부재 확인. 원격 keep. source1108개 전후 통과, artifact13개 사전통과. executed/PARENT_CHECK.json 및 runner 로그에 근거를 보존했다. 엔진·렌더 변경 없음.
