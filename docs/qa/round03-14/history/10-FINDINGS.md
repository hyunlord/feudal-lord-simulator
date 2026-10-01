# QA ROUND 10 — 발견 목록 (관찰 종료 · 패키지 검증 중)

HEAD `265079891b074d7e023674e17984c3ac828f6c8e`. 현재 확인된 고유 재현은 22개다. 실패 기준 23행에는 동일 QA029를 공유하는 UI-01/02가 포함된다. 회차 전체 해소 판정은 아니다.

경작지 안내 버튼을 누른 뒤 정지642→1×677로 진행한 것은 확인했으나, 실제 경작지 완료와 다음 안내도 나타났다. QA025의 입력·정지 정책 관련 표본으로만 남기며 기존 목표 보기 실패와 동일한 결함이라고 단정하지 않는다. 독립 판독 (원문 경로: repro/guidance10-review.md) · 전 (원문 경로: evidence/root10-005-guidance-paused.jpg) · 후 (원문 경로: evidence/root10-006-cropland-painted.jpg) · GIF (원문 경로: evidence/root10-guidance20.gif) · 전체 펼침 (원문 경로: evidence/root10-guidance20-unfolded.jpg).

회귀표 (원문 경로: REGRESSION.md) · 검토 기준 (원문 경로: CHECKLIST.md). 신규 QA032는 실제 진행·정상 저장/이어하기 보강 후 등록했다.

- **QA003 · 연결 · 중간 · 렌더/그림 추정** — 틱320000·줌2·칸(45,42) palisade-000041-segment-000의 접합 틈이 길처럼 읽힌다.19/19·방어100%·닫힌 고리 표기와 시각 연결을 구분한다. 동일 위치 (원문 경로: evidence/wall10-same003.jpg)

- **QA005 · 가림 · 중간 · 렌더/그림 추정** — 틱320047·줌2·칸(38,40)의 선택 운반인 로저 carter:construction-site-000048:319813 몸통/수레가 벽 끝·벽면에 겹친다.80장 후에도 같은 ID의 배송→귀환 상태를 확인했다. 충돌·길찾기 원인은 미판정이다. 선택 (원문 경로: evidence/wall10-wall-retry-selected.jpg) · GIF (원문 경로: evidence/wall10-selected-roger80.gif) · 전체 펼침 (원문 경로: evidence/wall10-selected-roger80-unfolded.jpg)

- **QA012 · 계절 지면 · 중간 · 렌더/그림 추정** — 겨울3793→봄4159·1×·줌2·카메라(544,-2277)180장 중104~112에 큰 대각 지면 경계가 이동한다. HUD100/QA101 봄, 지붕 눈114~115 전환을 분리한다. 전 (원문 경로: evidence/root10-035-winter-pre-transition.jpg) · 후 (원문 경로: evidence/root10-036-first-spring.jpg) · GIF (원문 경로: evidence/root10-winter-spring180.gif) · 전체 펼침 (원문 경로: evidence/root10-winter-spring180-unfolded.jpg) · 독립 판독 (원문 경로: repro/winter-spring10-review.md)

- **QA026 · 보행 · 중간 · 렌더/그림 추정** — 실제 선택 존 carter:construction-site-000081:320198·시작칸(22,32)·1×·줌2의 첫32장 남동 이동에서 다리 벌림 자세가 유지된다. 교차 수레2–4/16–18과 후반 식생을 제외했다. 다른 방향 사이먼과 동물 보행은 미검증이다. 확대 (원문 경로: evidence/wall10-john32-tracked.jpg) · GIF (원문 경로: evidence/wall10-john80.gif) · 전체 펼침 (원문 경로: evidence/wall10-john80-unfolded.jpg)

- **QA027 · 영주관 화풍 · 중간 · 렌더/그림 추정** — 틱322909·줌2·칸(29,17)의 선택 manor-house-29-17-0이 단색 갈색 지붕·회색 다각형 벽으로 보인다. 이미지 누락 등 내부 원인은 미확정이다. 선택 (원문 경로: evidence/wall10-manor-selected.jpg)

지면-01은 이랑 내부 줄기·그루터기의 시각 배치 후보로 유지한다.001·007 및 줄기 분리는 이번 짧은 표본에서 미재현이며 수정 완료를 뜻하지 않는다.002는 역할·동일 ID가 미확인이다. 월드 판독과 제외 표본 (원문 경로: repro/wall10-observation.md).

- **QA010 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 레거시1407 존26살에 나이 든, 조앤66살에 젊은 호칭이 보인다. 현재 신규 생성 이름 전체는 미검증이다. JPEG (원문 경로: evidence/ui10-005-person.jpg) · JPEG (원문 경로: evidence/ui10-011-records-1920.jpg)

- **QA029 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 375 리사이즈 및 최초375 컨텍스트에서 연대기 목록·닫기가 안 보이고 가로/세로 휠로 복구되지 않는다. Esc 복구 성공. 전기/결말의 단순 초기 잘림과 구분한다. JPEG (원문 경로: evidence/ui10-011-records-375.jpg) · JPEG (원문 경로: evidence/ui10-012-records375-wheel.jpg)

- **QA014 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 국왕 카드·전기에서 내부 역할 king이 그대로 보인다. JPEG (원문 경로: evidence/ui10-032-king-bio.jpg)

- **QA015 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 국왕과 자연1388 앨리스의 빈 기록 문장이 중앙 세로 장식선을 가로지른다. JPEG (원문 경로: evidence/ui10-032-king-bio.jpg) · JPEG (원문 경로: evidence/ui10-054-natural-child-bio.jpg)

- **QA016 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 길드1600/1280 정착 화면에서 보류 윗변이 둘째 선택지 우하단 테두리에 겹친다. resize 직후070 중복띠는 제외했다. JPEG (원문 경로: evidence/ui10-072-guild1600-settled.jpg) · JPEG (원문 경로: evidence/ui10-071-guild1280-settled.jpg)

- **QA017 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 생업375 리사이즈 후 상단 카테고리가 창밖이며 위쪽 휠/재열기로 복구되지 않았다. 최초375 건설 메뉴는 미검증이다. JPEG (원문 경로: evidence/ui10-043-build375-wheel.jpg) · JPEG (원문 경로: evidence/ui10-044-build375-reopen.jpg)

- **QA018 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 1280×720/375×812 설정 설명·음량 제목이 겹친다.768/1600/1920 표본은 분리됐다. JPEG (원문 경로: evidence/ui10-014-settings-1280.jpg) · JPEG (원문 경로: evidence/ui10-014-settings-375.jpg)

- **QA019 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 1600/1280/1920 설정 버튼 오른쪽이 잘리고768/375는 보인다. 노출 가장자리 클릭으로 열기/닫기는 가능하다. JPEG (원문 경로: evidence/ui10-014-settings-1920.jpg)

- **QA020 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 1407 월터 자손을 펼친 후 두번째 이름 줄이1600/1280/768/375/1920에서 카드 내부에 잘린다. JPEG (원문 경로: evidence/ui10-008-tree-expanded1600.jpg) · JPEG (원문 경로: evidence/ui10-009-tree-1920.jpg)

- **QA021 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 월드에서 선택한 엿기름 가마 닫기 기호는 기본/키보드 초점에 안 보이고 호버만 보인다. 장부→헛간 간략패널의 기본 붉은×와 구분한다. JPEG (원문 경로: evidence/ui10-059-world-facility-default.jpg) · JPEG (원문 경로: evidence/ui10-061-world-facility-focus.jpg)

- **QA022 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 정상 첫겨울 원본의 더 보기 클릭 후 본문 한 줄은 같고 버튼만 사라진다. 전 (원문 경로: evidence/ui10-083-firstwinter-before.jpg) · 후 (원문 경로: evidence/ui10-084-firstwinter-after.jpg) · GIF (원문 경로: evidence/ui10-firstwinter-motion.gif) · 전체 펼침 (원문 경로: evidence/ui10-firstwinter-motion-unfold.jpg) 습격 뒤 피해 카드도 추가 내용 없이 버튼만 사라졌다(전 (원문 경로: evidence/root10-113-war-aftermath.jpg) · 후 (원문 경로: evidence/root10-114-war-aftermath-more.jpg)).

- **QA023 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 375 월드 엿기름 가마 상세 위 길드/젖은 여름 칩이 시설 제목·설명을 가린다. 실제 닫기 클릭 오작동은 이번 표본에서 확인하지 않았다. JPEG (원문 경로: evidence/ui10-077-wet-facility375.jpg)

- **QA024 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 최초375 인물 닫기(x406.078,y486,55.922×44)가 모두 창밖이다. 가로 휠 실패, Esc 및Tab12→Enter 복구 성공. JPEG (원문 경로: evidence/ui10-022-fresh375-person.jpg) · JPEG (원문 경로: evidence/ui10-025-fresh375-close-focus.jpg)

- **QA025 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 목표 보기 클릭 후 정지430090→1×430129, 소개 없이 진행한다. 새20프레임 증거다. 경작지 안내 실행은 실제 다음 안내가 나타나 별도 범위로 보존한다. 전 (원문 경로: evidence/ui10-020-goal-expanded.jpg) · 후 (원문 경로: evidence/ui10-021-goal-after.jpg) · GIF (원문 경로: evidence/ui10-goal-motion.gif) · 전체 펼침 (원문 경로: evidence/ui10-goal-motion-unfold.jpg)

- **QA031 · UI 표시/접근 · 중간 · 렌더/UI 추정** — O활성 후1920/375에서 범례가 읽히지 않는다. QA끔1920도 확인했다. JPEG (원문 경로: evidence/ui10-015-problems1920.jpg)

004는 약10초 간격30장·마지막40장 범위에서 미재현이며 고침 판정이 아니다.028은 기록 존재 조건을 추가 확보해 아래 실패로 보강했다.030은 현재 금고 차이만 확인해 제한 확인으로 남겼다. 가족 가지 가독성은 관찰 후보이며 장 결산 재노출은 후속 보강으로 QA032에 등록했다. 자동 발전 (원문 경로: repro/auto10-review.md) · UI 범위 (원문 경로: repro/ui10-observation.md) · 결산 독립 판독 (원문 경로: repro/chapter-resume10-review.md).

- **QA032 · 완료 결산 재노출 · 중간 · 엔진 추정** — 같은 문맥에서 제4장 시작→1×40장 실제248559→248646 진행→정지·지금 저장→새로고침·이어하기4초 후 제3장 결산이 재노출됐다. 정지 상태 재접속에서도 앞서 같은 현상을 봤다. 내부 저장 손상·장 상태 역행 원인은 미확정이다. 진행 후 (원문 경로: evidence/root10-047-ch4-after-real-ticks.jpg) · 저장 (원문 경로: evidence/root10-048-ch4-save2.jpg) · 재노출 (원문 경로: evidence/root10-049-ch4-reload2.jpg) · 실제 진행 GIF (원문 경로: evidence/root10-ch4-resume40.gif) · 전체 펼침 (원문 경로: evidence/root10-ch4-resume40-unfolded.jpg) · 독립 초기 재현 (원문 경로: repro/chapter-resume10-review.md) 별도2→3장도160700까지 실제 진행·정상 저장 후4초에2장 결산이 재노출됐다(저장 (원문 경로: evidence/root10-122-chapter3-save.jpg) · 재노출 (원문 경로: evidence/root10-123-chapter3-reload.jpg) · 원본 내보내기 (원문 경로: repro/saves/natural1340-ch3-reload-repro.json.gz)).

- **QA028 · 인구 기록 접근 · 중간 · 렌더/UI 추정** — 자연 진행 후 1349년 봄·정지196161·줌2에서 인구 기록을 열어도 우측 상단 빈 띠만 보인다. DOM의149명 감소 기록은 화면에서 읽히지 않으며 띠 위 휠 뒤에도 유지된다(세계 줌은1.781로 변함). 열기 (원문 경로: evidence/root10-080-population-deaths.jpg) · 휠 후 (원문 경로: evidence/root10-081-population-scroll.jpg) · 1280 (원문 경로: evidence/root10-082-population-small.jpg)

관찰 후보 보강: 별개 창고 두 채의 외형 반복(정착 판독 (원문 경로: repro/repetition10-review.md))과 곡선 지면 OFF/ON의 경작 구획 무늬 소실·복원(비교 (원문 경로: repro/curve-toggle10-review.md))은 미적·식별 후보이며 새 QA번호를 부여하지 않았다. 동물280장 탐색에서도 이동 동물의 다리 교대는 미검증이다(범위 (원문 경로: repro/animals10-review.md)). 임금 경쟁의 더 보기도 QA022와 같은 유형으로 재현됐다(전 (원문 경로: evidence/root10-068-wage-competition-event.jpg) · 후 (원문 경로: evidence/root10-069-wage-more.jpg) · GIF (원문 경로: evidence/root10-wage-more20.gif) · 전체 펼침 (원문 경로: evidence/root10-wage-more20-unfolded.jpg)).

추가 후보: 책에서 부모·자녀가 같은 세대로 읽히는 표기와 여름·겨울 결산의 빈 장식 슬롯을 남겼다. 동일 모자 쌍의 가계도 대조와 결산 데이터 누락 여부는 미검증이다(재판독 (원문 경로: repro/ui10-remaining-review.md)). QA 오버레이는 검사한 닫기 경로에서 복구 불가 가림이 없었다. 추가1315 원본의 교회 건설·L4 이후 장1 종료·장2 소개에는 도달하지 못했다. 이후 별도1339 정상 원본으로 전쟁 후반·1340 결산·제3장 소개와 시작을 실제 확인했다(동선 (원문 경로: repro/chapter12-10.md)).

빈 평지의 마름모 색면 반복은 지면-02 후보로 보강했다(사진 (원문 경로: evidence/root10-102-open-ground-zoom2.jpg) · 판독 (원문 경로: repro/ground-repeat10-review.md)). 이번 신규 유상 이주민 선택과 기록은 의미상 일치했으며,1352년 청원자 세 명의 카드·전기에 고인 모순은 없었다. 과거 동일 인물·선택의 수정 완료 판정은 아니다. 달력의 시간 단위는 현재 표본에서 읽혔다(달력 (원문 경로: evidence/root10-110-calendar-time-unit.jpg)).

전쟁 후 연기100장에서는 새 접지·가림 결함을 확정하지 못했다. 연기의 위치·윤곽 변화와 주민 ID 미확보 한계를 구분했다(독립 판독 (원문 경로: repro/war10-review.md) · GIF (원문 경로: evidence/root10-war-smoke100.gif) · 전체 펼침 (원문 경로: evidence/root10-war-smoke100-unfolded.jpg)).
