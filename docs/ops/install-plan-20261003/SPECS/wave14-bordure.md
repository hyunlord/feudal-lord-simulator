# Wave14 외곽 띠 문장

분류 B · 1장 · 4–8시간 추정. 데이터만 추가할 수 없다.

`scripts/installWave14.py:3`는 bordure가 방패별 shield-UV mapping을 필요로 하므로 명시적으로 제외했다. `src/ui/heraldry/EmblemImage.tsx:102 composeArms`의 단순 ordinary 마스크 합성 경로로 넣으면 heater/knightly/rounded 방패의 외곽선과 띠가 일치하지 않는다.

연결: `src/ui/heraldry/heraldry.ts:61 armsRecipe`가 정하는 shield별 정규화 좌표계를 만들고 bordure를 방패 내부 경계에서 일정한 두께로 매핑한다. `records/metadata-heraldry.json` 및 제작 검수의 bordure shield 적용 예를 원본 기준으로 삼는다. 매핑이 완성된 뒤 `WAVE14_IMAGES`에 url/width/height/group 등록, `ORDINARIES`의 후보 확장은 가문별 기존 recipe 이동 여부를 별도 확인한다.

원본 `assets-inbox/wave14/candidates-v1/assets/heraldry/ordinary_bordure.png` → `public/assets/wave14/heraldry/ordinary_bordure.png`. 256×256, UI origin(0,0), season all, 월드 줌 무관. installed_by 예정 `INSTALL-WAVE14-20261003` (실제 적용과 검증 이후).

검증: 방패3종×색 조합×32/48/96/256px. 띠가 외곽 밖으로 새거나 아래 끝에서 뭉개지지 않을 것. 동일 가문 저장 전후/새로고침 recipe 일치. 단순 후보 추가를 즉시 설치 조각으로 내놓지 않는다.


## 용량과 공통 처리

이 실행 묶음 1장: 메타데이터 제거 후 원본 합계 0.00 MiB, 원본 RGBA 한 벌 산술 합계 0.25 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
