# 독립 시각 검수

원본 템플릿과 최종 592×296 마스터를 나란히 확대하여 확인했다. 머리 좌표는 알파 중심이 아니라 앞모습의 얼굴 중심/뒷모습의 두개부 중심을 직접 추정했다. 원본이 흐려 점별 약 ±2 마스터 px 불확실성이 있다. 아래 수치는 정밀 합격 증명이 아니다. 여성 시트의 강제 동일 알파는 해부학적 머리 정렬 증거로 사용하지 않았다.

|인물|방향|프레임|원본 머리(master)|후보 머리(master)|차이(final px)|판정|
|---|---|---:|---|---|---:|---|
|P1|NE|0|84,22|86,23|1.12|near_threshold_not_certified|
|P1|SE|0|79,23|80,25|1.12|near_threshold_not_certified|
|P1|SW|0|69,24|68,25|0.71|visually_consistent_with_tolerance|
|P1|NW|0|66,21|65,22|0.71|visually_consistent_with_tolerance|
|P1|NE|1|84,24|85,24|0.5|visually_consistent_with_tolerance|
|P1|SE|1|80,25|81,27|1.12|near_threshold_not_certified|
|P1|SW|1|67,26|68,27|0.71|visually_consistent_with_tolerance|
|P1|NW|1|68,22|67,23|0.71|visually_consistent_with_tolerance|
|P4|NE|0|95,21|94,22|0.71|visually_consistent_with_tolerance|
|P4|SE|0|81,23|80,25|1.12|near_threshold_not_certified|
|P4|SW|0|69,23|68,25|1.12|near_threshold_not_certified|
|P4|NW|0|57,21|57,22|0.5|visually_consistent_with_tolerance|
|P4|NE|1|95,21|94,22|0.71|visually_consistent_with_tolerance|
|P4|SE|1|85,23|84,25|1.12|near_threshold_not_certified|
|P4|SW|1|67,22|66,24|1.12|near_threshold_not_certified|
|P4|NW|1|57,21|57,22|0.5|visually_consistent_with_tolerance|
|P5|NE|0|84,22|84,23|0.5|visually_consistent_with_tolerance|
|P5|SE|0|74,26|77,25|1.58|near_threshold_not_certified|
|P5|SW|0|75,26|74,29|1.58|near_threshold_not_certified|
|P5|NW|0|65,22|65,23|0.5|visually_consistent_with_tolerance|
|P5|NE|1|85,20|86,20|0.5|visually_consistent_with_tolerance|
|P5|SE|1|74,23|77,24|1.58|near_threshold_not_certified|
|P5|SW|1|67,23|69,23|1|visually_consistent_with_tolerance|
|P5|NW|1|65,20|65,21|0.5|visually_consistent_with_tolerance|
|P6|NE|0|84,22|84,22|0|visually_consistent_with_tolerance|
|P6|SE|0|74,26|76,26|1|visually_consistent_with_tolerance|
|P6|SW|0|75,26|73,29|1.8|near_threshold_not_certified|
|P6|NW|0|65,22|65,22|0|visually_consistent_with_tolerance|
|P6|NE|1|85,20|85,21|0.5|visually_consistent_with_tolerance|
|P6|SE|1|74,23|77,25|1.8|near_threshold_not_certified|
|P6|SW|1|67,23|67,24|0.5|visually_consistent_with_tolerance|
|P6|NW|1|65,20|65,21|0.5|visually_consistent_with_tolerance|

## 관찰

- No gross direction reversal in 16 direction/gait pairs.
- Feet and leg trajectories visually follow templates; numerical alpha/RGBA check belongs to producer.
- P1/P4 costume and hands have been repainted, so exact arm pixels are not preserved. Broad arm pose remains comparable.
- P5/P6 red-brown lower hem bands survive under blue gowns because protected lower pixels include old garment.
- P6 NE f0 and f1 tiny pale apron edge remnants at right skirt side: remove for no-apron requirement.
- No extra carried props or signatures observed.
- Full head <=2px claim cannot be established by forced alpha mask, bbox matching or these approximate visual annotations alone.

초기 육안으로 제기한 SW f1 2–3 final px 이동 의심은 격자 대조 후 철회했다. 중심 추정치는 약 0.5–1.25 px다. 손/팔의 픽셀 동일성은 별도 보존되지 않았으므로 exact-pose pixel claim은 유보한다.
