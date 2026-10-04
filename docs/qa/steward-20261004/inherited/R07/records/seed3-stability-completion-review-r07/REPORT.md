# seed3 안정 방침 판 완료 독립 검수

**PASS_BOUNDED_COMPLETED_RUN**. seed3·open_field·fixed stability 판이 1450년/600000tick에 도달한 실제 산출물과 공식 runner 종료 증거가 일치한다. 완료 검사기를 다시 실행하는 데 그치지 않고 저장과 원장을 별도로 읽었다. 엔진·원격·브라우저 실행은 하지 않았다.

## 실행 출처

공식 `.remote-runs/astra-steward-seed3-stability-r07-5fb1aeb`의 exit-code는0이다. timing.env COMMAND_S=969.9, run.log 종료 문구도969.9초이고 마지막 진행행은600000tick/1450년/인구640/967초다. summary.seconds=967은 probe 내부 시간이라 runner 명령 시간과 범위가 다르다. run.log 명령은 seed3, core:open_field,150년,fixed,stability 및 지정 출력 경로와 일치한다. head5fb1aeb와 branch codex/phase15-organic-ground가 기록됐다.

복사본 manifest22개 전부 일치했다. 그중 게임 산출물19개는 공식 보존 디렉터리의 같은 이름 파일과 SHA가 같고, runner-exit-code/timing/unit 3개는 공식 파일과 byte 단위로 동일하다. 부모 SEED3_STABILITY_RESULT의7입력SHA도 현재 파일에 일치한다. metadata의 핵심 source9개는 현재 저장소SHA와 일치했다. run.log는 별도로32개 경로가 HEAD와 다르다고 쓰지만 changed-files.txt는 비어 있다. 따라서 전 저장소 clean을 이 자료로 독립 입증했다고 표현하지 않는다. 기록된9 source pin 및 결과 입력 동일성 범위에서 승인한다.

## 저장과 기록의 별도 대조

- 연간150행: periodYear1300–1449, year1301–1450, tick4000–600000, throughTickExclusive=tick. 모든 행의 stability/dues1000/subsidies[] 일치.
- 실제 저장9개: start,latest,6개25년 체크포인트,final. 원시 state JSON SHA를 계산해 해당 label/tick의 codec 로그와 비교했다. 전부 일치했고 실제 agency 통제도 일치했다. start는0,final은600000tick이다.
- codec38행의 exactJsonRoundTrip=true 및 SHA 일치는 기록으로 확인했다. 30회 latest 저장은 같은 파일을 덮어쓴다. 따라서38개 과거 파일을 모두 독립 decode했다고 주장하지 않는다. 이번 검수에서 실제 codec은 실행하지 않았다.
- 최종 population=640. ledger cash entries와 rollups의 cash 합을 독립 집계하면521469d로 summary·마지막 연간행·부모 결과와 맞는다. 이것은 잔고 일치이며 모든 거래의 적법성·원장 완전성·경제 균형 증명은 아니다.
- persons.past의 alive=false 2236명: age1840,fire13,famine_year14,famine27,plague342. 150개 연도별 deathYear 경계로 누적 재집계해 annual.retainedDeathsByCause와 대조했으며 불일치0이다. checkpoint들의 당시 인구·원장 잔고·보존 사망 집계도 해당 연간행과 일치했다. 기록된 인물의 사망 집계이며 전세계 인구·분모·실제 사망률·인과 분석은 아니다.
- summary.findings=[]와 pendingIntentionalWaits=[] 확인. findings 없음은 probe에 구현된 검사 범위의 결과이며 알려진 모든 결함이 없음을 뜻하지 않는다.

근거 의미는 probeMetrics.ts13–22 및 ledger.ts38–70의 집계 경로와 대조했다. 전체 자원 보존·모든 현금거래 원장 포함·권리 전체 이력·죽은 행위자의 명령 거절·전체 결정론 재생·UI/재미는 미검증이다. 단일 seed/policy 완료로 정책 우열이나 게임 전역 안정성을 확정하지 않는다. 프로세스 정리/port 해제는 이번 로컬 파일검수에서 재확인하지 않았다.

독립 Ruby 검산 첫 실행에서 설치 Ruby의 filter_map 미지원으로 중단됐고, 소유 audit.rb만 map.compact로 고친 후 전 검산이 완료됐다. 원본 게임/보고서/입력 파일은 수정하지 않았다.
