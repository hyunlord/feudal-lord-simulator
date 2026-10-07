# RB-WET-PATHS — 여름 진흙 길 2장

독립 실제 브라우저 15쌍은 PASS다. 최신 WALKER 본선 통합 뒤 7쌍의 픽셀·그림 소비 검증도 완료했지만, 통합 실행과 추가 영상 실행은 telemetry 요청 취소 때문에 exit 1이다. 실행 성공과 화면 관찰을 구분한다. 최종 정확한 트리의 변경 시험·기하·병합 검사·게시 SHA는 전달 receipt에 기록한다.

제품 `34ac3c3a`, WALKER `1a02c93a` 통합 `7f305b38`, 설치기 반복 실행의 불필요한 다른 catalog 표기 변경을 막은 `7478f970`. 엔진·저장·UI-A·기상 모델·감사 규칙을 바꾸지 않았다.

## 실제 변화와 출처

원본 `path_muddy_ne_summer.png`, `path_muddy_nw_summer.png` 두 장을 public Wave42 paths와 공용 `wet-paths` bundle에 설치했다. 각512×64 unwrapped UV, 피벗(256,32), 기존 균등 투영 배율0.5, 반전 없음. 받은 바이트와 런타임 바이트가 같다.

- NE SHA256: `799ccd46ae92650f033240863227db1aab519afeac6cb266ec72641f1d85643d`
- NW SHA256: `463aee24fdb0247e576c5bf9aafc065e159de9cc00473882e085ce9cebaba2f8`

원본은 `assets-inbox/wave42/candidates-20261002/assets/paths/`, 당시 프롬프트·참조·생성 후 처리는 `generation-records.json`에 보존했다. 설치 때 새 그림·늘이기·색 변경·미러링은 하지 않았다. 겨울2장은 기존 modeledWetness가 겨울0이므로 **미설치·자료 보존**이다. 4장 설치로 세지 않는다.

기존 `modeledWetness`와 `weatherFx`를 사용한다. 따뜻한 계절은 기존 stageSeason의 summer 자산을 쓰며, 젖음6단계와 dry0으로 ground chunk 캐시를 갱신한다. 준비 여부와 설정도 키에 들어간다. clear 직선의512 UV 세계 위상을 그대로 쓰고, 각 연결부 중심±64 UV는 clear로 두고 다음64 UV에서 smoothstep으로 진흙을 섞는다. 모든 clear 연결 중심을 보존하여 직선/모서리의 단단한 사각형 경계를 피한다. 기존 땅 multiply는 같은 날씨 곡선의 주변 지면 표현이며 별도 토양 사실을 추가하지 않는다. 영구 마모·이동 비용·지역별 빗물 누적은 없다.

## 실제 게임 화면

`astra-rb-wet-paths-qa-v2-34ac3c3`: baseline56aae1a6 대비15쌍, exit0, JS오류0·예상 밖 요청 실패0. 비활성/미준비 시험의 두 PNG 차단은 의도된 조건이다. current codec 저장을 읽고 정상 advanceTick450회로 만든 wet0~6과 기존 여름/겨울 저장을 사용했다. 같은 상태SHA·카메라끼리 비교했으며 render nowMs1000 고정은 움직이는 층을 통제하기 위한 하네스 HTTP 변환이다. 엔진 상태를 고치지 않았다.

raw 세계 캔버스에서 dry0·weatherFx off·그림 미준비·겨울 세 줌 모두 변경 픽셀0. 젖음1~6은3696/3908/4095/4239/4289/4356픽셀, 평균RGB차4.69→21.86으로 증가했다. 여름0.6/1.4줌은1722/8440픽셀이다. DOM과 Offscreen drawImage를 함께 추적해 각 NE/NW 원본→scratch→ground chunk→실제 세계 캔버스 도달을 확인했다. 소비 횟수에는 화면 밖으로 잘린 chunk 작업도 포함될 수 있어 보이는 픽셀 수와 같다고 하지 않는다.

`astra-rb-wet-paths-integrated-7478f97`: baseline1a02c93a 대비7쌍, 모든 상태·카메라·draw 검증 및 JS오류0. dry/off/미준비/겨울 픽셀0, 젖음0.5/1 및 여름0.6에서4090/4356/1722픽셀 변화. after stage0에서 telemetry/sample 요청1건이 취소되어 **전체 exit1**이며 원인 미확정이다. [통합 관찰 JSON](integrated-comparison.json)에 실패와 픽셀 관찰을 함께 기록한다.

직선 NE/NW, strip-only 꺾임과 chunk 경계를 실제 원본/세계 PNG 및 사용된 ground chunk에서 확인했다. 진흙이 clear 연결부로 부드럽게 줄어드는 모습을 관찰했다. 일부 연결부는 건물 뒤에 가려진다. authored fork는 이 실제 저장에 없으며 단위시험으로만 배치를 확인했다. 0.6에서는 표면 결의 세부 판독이 어렵다.

보충 zoom3(정상 최대 줌2보다 큰 시험 카메라)와 실제 설정 on→off 실행은 telemetry 취소1건으로 exit1이다. 설정 전환 뒤 정착한 화면은 baseline off와 변경 픽셀0이고 muddy 세계 draw0이었다. 이는 좁은 관찰이며 보충 실행 전체 PASS가 아니다. [별도 기록](supplemental-toggle.json).

## 실제 여름 비·젖음 연속 기록

기존 trade72 `tick-005000.save.json`, seed1,1301여름 시작을 현재 codec로 읽었다. 초기 wetness0, 현재wet/직전normal이다. 줌1과0.6 모두 같은 저장SHA·카메라 타일(43,37),1280×800·DPR1, 실제1배속 게임과 실제 renderclock을 사용했다. 위 정지 비교의1000ms 고정을 사용하지 않았다. 강제 날씨·날짜·엔진 상태 변경이나 선택 결과 주입은 없다.

`astra-rb-wet-paths-warm-motion-7478f97`: 줌1은212프레임·tick5000→5451·45.43초, 줌0.6은167프레임·tick5000→5450·45.38초. 프레임 간격 중앙값은각214.9/267.1ms이며 최대464.5/556.2ms다. 모든379프레임에서 roofSnowAlpha 최대0·treeSnowy수0, wetness0→1, 실제 wave39 rain_streak 그림의 세계 목적지 변화가 기록됐다. 원본 PNG, 시간·틱별 메타데이터, 같은 지면 ROI와 전체 세계를 함께 보여 주는 가변 프레임 간격 영상4개를 보존한다. 프레임 보간·색/대비 증폭은 없다. ROI만 nearest-neighbor로 확대했다.

눈 녹음 없이 도로·풀의 명도 변화는 읽힌다. 다만 **빗줄기는 작고 옅어 넓은 이동 비 띠가 눈으로 뚜렷하게 보인다고 판정하지 않는다**. root도 연속 프레임과0.6 경로 ROI를 직접 보고 같은 한계를 확인했다. 영상은 실제 비 그림 움직임과 일정 기반 전역 젖음이 함께 진행하는 기록이며, 특정 셀에 비가 지나간 결과로 물이 쌓였다는 증거가 아니다. 비 가시성을 조정하는 제품 변경은 이번 범위에 넣지 않았다.

영상 실행의 JS오류/장면 assertion 실패는0이지만 capture 중 telemetry/sample `ERR_ABORTED`10건으로 **exit1**이다. 원인 미확정이며 정상 종료 탓으로 돌리지 않는다. [영상 요약](motion-summary.json)에 전체 실패 기록을 보존한다. 전달 ZIP에는 영상·대표 원본·379프레임 SHA 목록과 외부 원본 경로를 넣고887MB 전체 PNG는 외부 증거 폴더에 유지한다.

앞선 tick20000→20450 영상404프레임은 시작 화면에 봄 잔설이 있어 이 요구의 통과 자료에서 제외했다. 초기 motion 시도는 이야기 창의 버튼 가림, 다음 시도는 거대한 Playwright 프레임 배열 반환의 ERR_STRING_TOO_LONG과 탭 중단으로 실패했다. 정상 UI 닫기·프레임별 디스크 저장으로 하네스만 고쳤다. 최초 독립 비교의 font allowlist 실패 역시 별도 보존하며 성공한 재실행으로 대체했다.

## 검증·한계

집중39시험, typecheck, targeted ESLint 통과. 새 helper81·draw143·model241줄로250한도를 유지했다. 기존36 NAT5 digest `7ab86a324afd0de32925e50434e71b4def579aed70f97777f5996225439c0db3`를 바꾸지 않았으며 legacy tree/fallow/path 범위만 고정했다. WALKER20 원본SHA와 모든 기존 bundle 값을 보존했다. 성능 개선이나 장기 플레이 안정성은 주장하지 않는다.

A3/A4: 기존 날씨·길 사실만 읽고 경제/엔진 규칙을 추가하지 않는다. A5/A7: 원본·실제 소비·실패 실행·미설치 겨울과 시각 한계를 분리한다. 모든 하네스·대용량 증거는 최종 관문 전에 작업 트리 밖으로 옮기고 clean 정확한 트리에서 관문을 수행한다.
