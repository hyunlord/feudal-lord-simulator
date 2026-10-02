# Wave41 추가 숲 전이띠 A/B

- assets/woodland_edge_a.png, assets/woodland_edge_b.png: 각각512×64 RGBA, pivot(0,0), X반복, 위meadow/아래woodland.
- A는 낮고 완만한 낙엽·이끼 전이, B는 조금 더 구불구불한 초지 만입. 나무·큰소품·문자·밝은테두리·검은선 없음.
- 내장 imagegen 실호출 A2회/B1회. A1은 원시질감이 흐린 독립띠처럼 보여 제외. 전체 프롬프트·원시 경로·참조 해시: records/generations.json 및 attempt1-records.json. raw/에 원시본 보존.
- 참조는 임시wt가 동시 외부병합으로 krill로 이동한 뒤 krill/public/assets에서 복사·고정했다. references/grass.png, woodland_floor_summer_a/b.png, heath_edge_a.png.
- 후처리: 유효재료 영역 추출,512×64 단일축소, 실제grass/woodland 평균색과의 세로 보간 보정, 상하13px alpha feather, 좌우24px반복 이음 혼합. A2 원시의 흰 외곽은 유효재료 밖 영역을 제외해 제거했다. 후처리 스크립트: records/finalize.cjs.
- proofs/AB-actual-fills.png: 위A/아래B, 실제grass/woodland fill 위 각3회 반복한 오프라인 합성. proofs/alpha-dark-light.png: A어둠/A밝음/B어둠/B밝음 배경, 각2회반복.
- 최종 검수 PASS_OFFLINE: 두파일512×64 RGBA, alpha0..255, 좌우첫/끝RGBA 최대차0, native proof에서 수직이음·밝은테두리·독립blur띠 없음.
- 반복 가장자리 일치가 모든 런타임 연결 방향의 통과를 뜻하지 않는다. X반복만 계약이며 코너/수직방향은 별도 구현 검수 대상. 게임설치·제품코드 변경 없음. 승인29장 미변경.

## 추가 검증

최종 alpha=0인 첫/끝행 각1024픽셀의 RGB를 전부0으로 정리했다. 두 파일 모두 hidden RGB nonzero=0. records/finalize.cjs는 문자열/객체 참조JSON 모두 재실행 가능하도록 처리했다. records/verify.cjs가 최신해시·알파검사를 갱신한다.

proofs/scales-0.5-1-1.4.png는 동일한 실제fill A/B 합성 화면을0.5/1/1.4로 리샘플한 오프라인 검수판이며 게임실행 캡처가 아니다. 세 크기 모두 수직이음·독립흐림띠·밝은 외곽선이 없는지 직접 확인했다.
