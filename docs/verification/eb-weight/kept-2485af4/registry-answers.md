# 등록 답변과 추적 스레드 집계 분리

원본 seed1 SHA-256: `3cf11889398f36ac8dc8c0230dc509d5e46cbaa8abdcd1f568d7a0744600dbfd`. 원본과 기존 root-matter 요약은 수정하지 않았다. 세 seed 종합이 아닌 완료된 seed1의 추가 분석이다.

- 제시 50건: 실제 영주 답변45, 청지기 답변4, 무효1. 정확한 occurrence ID·history subject·명령·선택·시각을 대조했다. 미해결 결합0.
- 영주 답변 연간 중앙값0·최대2·0인 해87. 기존 등록 스레드38의 중앙값0·최대2·0인 해91과 단위가 다르다. 전체 중대91도 root matter 집계이며 전체 실제 답변 수라고 해석하지 않는다.
- 충분한 후속 관찰 기간이 있는 영주 답변42건 중 직접 because 연결26건. 기간이 짧은3건 중 직접 연결2건은 별도다. 기존 성숙 등록 root26/35를 실제 답변26/42와 구분한다.
- 038은 defer6·enforce2의8답변이며 직접 because 연결0. 나중 답변7개는 기존 root에 합쳐진 후보가 각각 하나다. enforce2개에만 해당 답변 이후 간접 root 결과가 있다. 이는 최종 alias·대상·시각으로 추론한 후보이며 정식 멤버십이나 인과 증명이 아니다. 앞선 root의 과거 결과를 나중 답변에 소급하지 않는다.

구현: `scripts/engineBRegistryAnswerAudit.mjs`; 3seed 보고서의 `registryAnswers`에 별도 추가한다. 기존 `pooled/perSeed/perEntry`는 root 기준을 유지한다. 청지기 답변4건은 실제 철 보고 화면 검증을 대신하지 않는다.
