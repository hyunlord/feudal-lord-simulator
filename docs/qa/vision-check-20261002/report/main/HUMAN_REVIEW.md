# 직접 시각 판정표

판정자: 이 세션의 assistant. 실제 원본 프레임·확대 crop·스프라이트 원본을 직접 보고 판정했다. 독립 인간 평가자나 이중맹검 결과가 아니다.

| ID | 장면 | 검출기 | 상자 x,y,w,h | 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| city-summer-z1.0:scale_ratio:0 | city-summer-z1.0 | scale_ratio | 1184,786,64,32 | TP | 빗물통 몸체가 주변 성인보다 큼; 부속 울타리를 포함한 alpha 비율은 정확한 통 높이가 아니므로 참고값 |
| city-summer-z1.4:scale_ratio:0 | city-summer-z1.4 | scale_ratio | 1337,900,90,45 | TP | 빗물통 몸체가 주변 성인보다 큼; 부속 울타리를 포함한 alpha 비율은 정확한 통 높이가 아니므로 참고값 |
| city-winter-z1.0:scale_ratio:0 | city-winter-z1.0 | scale_ratio | 1408,674,64,32 | TP | 빗물통 몸체가 주변 성인보다 큼; 부속 울타리를 포함한 alpha 비율은 정확한 통 높이가 아니므로 참고값 |
| city-winter-z1.0:scale_ratio:1 | city-winter-z1.0 | scale_ratio | 1280,738,64,32 | FP | 뒤쪽 통이 가려져 장작·지붕을 잰 오탐 |
| city-winter-z1.0:scale_ratio:2 | city-winter-z1.0 | scale_ratio | 1184,786,64,32 | TP | 빗물통 몸체가 주변 성인보다 큼; 부속 울타리를 포함한 alpha 비율은 정확한 통 높이가 아니므로 참고값 |
| city-winter-z1.0:scale_ratio:3 | city-winter-z1.0 | scale_ratio | 1184,818,64,32 | TP | 빗물통 몸체가 주변 성인보다 큼; 부속 울타리를 포함한 alpha 비율은 정확한 통 높이가 아니므로 참고값 |
| city-winter-z1.4:scale_ratio:0 | city-winter-z1.4 | scale_ratio | 1337,900,90,45 | TP | 빗물통 몸체가 주변 성인보다 큼; 부속 울타리를 포함한 alpha 비율은 정확한 통 높이가 아니므로 참고값 |
| city-winter-z1.4:scale_ratio:1 | city-winter-z1.4 | scale_ratio | 1337,945,90,45 | TP | 빗물통 몸체가 주변 성인보다 큼; 부속 울타리를 포함한 alpha 비율은 정확한 통 높이가 아니므로 참고값 |
| 0024439d11e7 | coast-summer-z0.6 | straight_boundary | 1477,576,113,63 | FP | 완만하게 굽은 해안 식생 경계의 짧은 부분이 등각 방향과 우연히 일치 |
| 8f7a7bdbd27d | coast-winter-z0.6 | straight_boundary | 1496,582,104,61 | FP | 완만하게 굽은 해안 식생 경계의 짧은 부분이 등각 방향과 우연히 일치 |
| 651a719b2de1 | fen-summer-z1.0 | straight_boundary | 1026,610,173,13 | TP | 자연 지면 영역이 화면 수평 또는 수직으로 곧게 잘려 사각 판 경계가 드러남 |
| 0bcd64c02c0e | fen-winter-z1.4 | straight_boundary | 1107,657,247,13 | TP | 자연 지면 영역이 화면 수평 또는 수직으로 곧게 잘려 사각 판 경계가 드러남 |
| 1b7b13a53e65 | forest-summer-z0.6 | straight_boundary | 776,546,150,13 | TP | 자연 지면 영역이 화면 수평 또는 수직으로 곧게 잘려 사각 판 경계가 드러남 |
| be5decd3c98e | forest-summer-z1.0 | straight_boundary | 765,581,234,13 | TP | 자연 지면 영역이 화면 수평 또는 수직으로 곧게 잘려 사각 판 경계가 드러남 |
| b47bd7b31517 | forest-summer-z1.0 | straight_boundary | 1216,805,196,13 | TP | 자연 지면 영역이 화면 수평 또는 수직으로 곧게 잘려 사각 판 경계가 드러남 |
| 475a02c7640b | forest-summer-z1.4 | straight_boundary | 753,617,331,13 | TP | 자연 지면 영역이 화면 수평 또는 수직으로 곧게 잘려 사각 판 경계가 드러남 |
| 42a8ceb4e99c | forest-summer-z1.4 | straight_boundary | 1235,774,291,13 | TP | 자연 지면 영역이 화면 수평 또는 수직으로 곧게 잘려 사각 판 경계가 드러남 |
| 4bae0cb3c014 | forest-summer-z1.4 | straight_boundary | 1357,930,243,13 | TP | 자연 지면 영역이 화면 수평 또는 수직으로 곧게 잘려 사각 판 경계가 드러남 |
| 23cd05995ffd | forest-winter-z0.6 | straight_boundary | 776,546,151,13 | TP | 자연 지면 영역이 화면 수평 또는 수직으로 곧게 잘려 사각 판 경계가 드러남 |
| 3f99d750f631 | forest-winter-z1.4 | straight_boundary | 753,617,328,13 | TP | 자연 지면 영역이 화면 수평 또는 수직으로 곧게 잘려 사각 판 경계가 드러남 |
| 5aa65b4cc116 | forest-winter-z1.4 | straight_boundary | 1357,930,243,13 | TP | 자연 지면 영역이 화면 수평 또는 수직으로 곧게 잘려 사각 판 경계가 드러남 |
