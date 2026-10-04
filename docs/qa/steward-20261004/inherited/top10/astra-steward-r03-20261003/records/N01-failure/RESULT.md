# SAVE01 — 당기 납부·과거 체납 병존 저장을 공식 로더가 거부

심각도 **높음**, 담당 **엔진**, 상태 **현행 HEAD에서 재현됨 / 미수정**.
HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742`. N01 seed 1, core:open_field, full 영주 봇, 시작 1300. 1440년 tick560000 체크포인트에서 exit1로 종료했다. 150년 완주가 아니다. `summary.json`/최종 저장은 생성되지 않았다. 마지막 연간 기록은 1439년(tick560000), 마지막 성공 저장 검증은 1435년이다.

## 직접 재현

원본 `latest.fls.json` SHA256 `f95a35dee518c76ce539d16dc949d4e25c241e403fe30afa301f594a1e20d3de`.

DGX 공식 runner, nice19, 별도 `astra-steward-N01-savebytes-r03-5fb1aeb`에서 원본 Buffer를 `decodeSave`에 입력했다. 결과:

```
Error: Save state unpaid buildings do not match the arrears queue
```

원본 bytes 변경 없음. 해당 진단 프로세스 exit0은 예외를 포착·기록했다는 뜻이며, 저장 검증 성공이 아니다. `savebytes-confirmed/run.log`에 정확한 명령·응답, timing/exit가 있다. 최초 진단은 잘못된 문자열 입력으로 TypeError였으며 `savecheck-first/`에 별도로 보존했다.

## 원인과 구별 근거

- `src/engine/moneyRules.ts:225`는 과거 체납을 유지한다. `:227–235` FIX-4는 당기 미납에만 건물 `upkeepUnpaid`를 설정하고 당기 납부 시설의 표식을 지운다.
- `src/engine/moneyValidation.ts:32`는 전 기간 체납 건물을 모은다. `:36–37`은 과거 체납뿐이어도 표식 없는 현존 건물을 거부한다.
- 원본 체납93건, 체납 건물16개, 표식9개. 표식9개는 최신 정산559200의 미납 건물 집합과 일치한다.
- 나머지7개(000017/000032/000038/000039/000027/000015/000016, 모두 construction-site- 접두사)는 오래된 빚이 남았지만 최신559200 정산의 cash/upkeep 지급 원장이 있다. 상세 `SNAPSHOT_AUDIT.json`.
- 원본 돈 검증은 위 오류. 복제 객체에만 7개 표식을 넣은 진단 비교군은 moneyStateProblem=null. 원장 체납 합계 검증까지 통과하므로 이 입력의 첫 거부는 표식 계약 충돌로 좁혀진다. 비교군을 올바른 게임 상태나 수정안으로 취급하지 않는다.
- 외부 하네스는 공식 newGameState/reducer/advanceTick으로 진행하고 money/building을 직접 변조하지 않는다. checkpoint는 encode→파일 저장→decode 순서(`output/steward-probe-v2/stewardProbe.ts:73–75`)라 실패 원본은 보존된다. decoded를 시뮬레이션 상태에 재대입하지 않는다.
- 독립 읽기 검수 두 건에서 원장/표식 충돌과 하네스 호출 순서를 각각 교차 확인했다. 공식 decoder 재현은 주 실행자가 별도로 확인했다.

## 엔진 수정 방향과 검증 요구

과거 채무 잔액과 당기 운영 중단 표식을 서로 다른 의미로 검증해야 한다. 전체 체납 건물을 강제로 중단시키는 수정은 FIX-4 취지를 되돌린다. 단순 `arrear.tick === state.tick`도 정산 사이의 저장을 오판하므로 부적절하다. 최신 유효 정산 경계/상태 계약을 엔진 담당자가 정하고, 당기 납부+과거 체납, 당기 미납, 정산 사이 저장, 건물 소멸, 실제 체납 원장 불일치를 각각 검증할 필요가 있다.

엔진/렌더/저장 형식 수정 없음. 최초 불일치 발생 tick, 모든 seed 재현, 실제 브라우저 로드 화면은 미검증. 현재 확인은 공식 저장 API 거부이며 UI 결과를 확장 주장하지 않는다.
