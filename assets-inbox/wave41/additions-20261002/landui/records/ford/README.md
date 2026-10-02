# Wave41 addendum — w1 ford 후보 4장

`assets/ford_w1_{ne,nw}_{summer,winter}.png`: 512×256 RGBA, pivot(256,128), 제작타일128×64, renderScale0.5. 내장 imagegen 개별4회 생성. 기존 w2를 축소한 결과가 아니다. w2는 재료/크기 참조였고 새 w1은 징검돌3개와 짧은 물구간으로 재생성했다.

참조 원본은 생성 직전 krill/public/assets/wave34/ford에서 references로 고정 복사했다. 최초 전달 scratchpad/wt 경로는 삭제되어 없었다. raw/에는 실제 도구 출력, records/generation-*.json에 전체 프롬프트·경로·참조·해시·후처리가 있다. 명시적 model/seed는 제공되지 않아 null이다.

검수: **PASS_WITH_LIMITATIONS / offline candidate**. 투명 외부, 열린 얕은 물, 자갈, 방향별3개 돌, 짧은 흙 경사로와 수레홈 확인. 목재 다리/난간/글자 없음. 상좌광 유지. 겨울은 여름과 최종 alpha 차이0; 바깥 눈덩이 추가 없음. 중앙 접합점은 NE(224,144)/(288,112),NW(224,112)/(288,144)에 자갈/수면 전이가 오도록 신규 출력 크기와 위치 정합. 이는 시각적으로 수px 폭을 가진 자연스러운 둑 전이이며 수면 경계가 수학적 선과 픽셀단위 동일하다는 주장은 하지 않는다.

w2 대비 원래 여울 길이는 줄고 도로 폭은 비슷한 범위다. NE 돌이 w2보다 조금 작게 보이며 NW 돌은 유사한 크기다. w2와 돌/길폭 수치가 완전히 동일하다는 판정은 아니다. 석재 자체가 작은 타일 크기에 읽히는지를 scale0.5×zoom0.5/1.0/1.4에서 확인했다. 최저줌은 세부 자갈이 아니라 3개 밝은 돌과 방향으로 읽힌다.

후처리: 새 w1 여름 출력 전체를 균일 리샘플하고 새 캔버스 안에서 좌표 정합; 겨울 RGB bbox를 자체 여름 bbox에 등록하고 자체 여름 alpha를 재적용. 물색 픽셀alpha 상한220, 높은alpha245초과는255로 정리. 겨울 검은 RGB fringe는 가까운 내부색으로 확장했고 일부 고채도 생성 edge 픽셀은 회색화. 원본w2 alpha 보존을 주장하지 않는다.

증거: proofs/comparison.jpg는 최종 native w1/w2 및 표시 배율 비교, proofs/geometry.png는 최종 중앙 다이아몬드·접합점 검수판, proofs/light-dark.jpg는 최종 밝음·어두움 배경 검수판이다. 세 proof 모두 최종 PNG bytes에서 재생성하여 직접 확인했다. records/final-proof-verification.json에 자산 및 proof SHA, generation/QA 해시 일치, alpha0 RGB 전부0, 계절 alpha 차이0을 검증했다.

미검증: 실제 게임 합성·물길색 맞춤·manifest연결·보행 충돌. 현재 renderer w1 연결은 별도 엔진 작업이며 설치/코드 변경하지 않았다. 원본 승인 및 기존29장 패키지도 수정하지 않았다.
