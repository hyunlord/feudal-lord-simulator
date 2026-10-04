# A01 — 1315년 자율 사업 후보 탐색의 큰 지연

**중요도 높음·엔진 담당, 신규 실측.** 게임 수정/해결 완료가 아니다. seed1,core:open_field,full lord bot, HEAD5ad4b834. 원격 실행 astra-STEWARD-R01-5ad4b83, PID3448143 nice19.

## 확인한 것

- tick60000/year1315까지 progress wall seconds242. 이후 몇 분 동안 다음1000틱 progress가 없지만 프로세스는RNl이고 CPU시간 증가.
- Inspector 스택 세 번은 모두 우물 후보의 목책 공간 검사를 포함. 두번째 내부state.tick60450/main60449,세번째60840/main60839. **진행은 있으므로 무한루프가 아니다.**
- call chain: advanceTick→advanceTownAgency→townProposals→autoplayBuildAction→findBuildSite→autoplaySiteCheck→preservesAutoplayWallSpace→computePalisadeProposal→palisadeLandEnvelopes/검증.
- 10.454566초 CPU 프로파일646 samples 중 목책LandEnvelope/Geometry623(96.44%),GC16. 이는 실행위치의 샘플비이며 전체벽시계시간의96.44%라고 해석하지 않는다.
- population528,era hamlet,width64,height64. 후보key가60,3,1,1→5,1,1,1→52,4,1,1로 달랐다. 서로다른tick/후보의반복계산을 관측했다.

## 재현 입력과 근거

`records/repro-1315.fls.json`은 공식 저장tick60000이다. 이 저장은60450직전 정확 상태와동일하지 않으며 같은full봇명령을계속실행해야한다. 원본하네스·실행계약은 records/probe/와long-run/PROTOCOL.md. 다시실행은 현재작업종료후 한개씩DGX에서;이보고서 작성시두번째실행없음.

records/debug-stack-01.json,02.json,03.json / debug-profile.json / debug-profile-summary.json. Inspector는 관측중 잠깐멈췄다가 매번resume했고프로파일러도disable했다. localhost9229종료는debugjournal에서추적한다.

## 아직 모르는 것

낮은nice·공유cgroup경쟁이절대시간에끼친비중,1315방침전환이직접원인인지,화면프레임의실제멎음,최적화후동일결과보존,전체150년완주. 단일10초프로파일로모든과정의최대비용을인증하지않는다. 원인토글A/B와최소재현은후속검증이다.

수정방향은별도 PERF_SOURCE_REVIEW.md의코드감사와함께읽는다. 검색량을줄여좋은후보를잃거나seed결과를바꾸는지확인없이엔진패치를적용하지않는다.

## 14:02 KST 후속 확정
다음progress가발행됐다: tick61000/year1315/seconds806/pop528/findings0. tick60000의seconds242에서 **1000틱에564초** 걸렸다(검수 일시정지·프로파일링·공유부하 포함). 150년전체가멈췄다는주장은하지않는다. 이관측구간의느림은로그로확정했다.
