# 제외 1,181행 재검토

판정: **분리 유지, 게임용 누락 발견 0건**. 이는 그림 내용 전수 육안 검수가 아니라 경로·개별 비고·제작 계약·공식 메타데이터의 역할 대조 결과다.

모든 제외 행의 폴더와 확장자, 비고를 재검토했다. `assets`, `manifest`, `contract`, `catalog` 명칭의 묶음 CSV/JSON에서 제외 파일명을 찾아, 실제 출력 경로인지 입력 참조·마스크·검수 산출물인지 확인했다. 이름만 같은 서로 다른 경로는 같은 납품 파일로 처리하지 않았다. 설치 대장 `sourcePath`가 제외 그림을 직접 가리킨 경우는 **0건**이다.

|헷갈리기 쉬운 자료|확인 근거|판정|
|---|---|---|
|Wave 36 records/masks/add_firewood.png 등|해당 records/assets.csv는 `file=assets/add_firewood.png`, `mask=masks/add_firewood.png`를 별도 열로 구분|실제 그림과 같은 이름의 제작 마스크, 제외 유지|
|lineage/prod2의 attempt1·rejected PNG|records/assets.json에서 `referenceImages` 입력으로 참조|최종 초상 출력이 아닌 수정 전 시도, 제외 유지|
|Wave 23 life-ground-…-protected.png|records/asset-manifest.json에서 `mask` 항목, protectedPixelDifferences 검증|보행 보호 영역 검사 마스크, 제외 유지|
|Wave 14 heraldry-composites·heraldry-textured의 01~24.png|후보 README 7·16·26행은 assets가 최종 PNG, 24조합은 검사 예시. 질감 재작업 README 21행은 seed140926 재합성 확인물|문장 조합 검수 예시, 제외 유지|
|Wave 13 records/carts의 cell·pair 그림|README 8행은 assets/cart가 최종 몸체 시트, 24·28행은 분리 레이어 조립 확인 및 납품 34개 명시|셀 분할·조립 제작 기록, 제외 유지|
|Wave 2 assets.csv가 runtimePath로 가리키는 checks/01-street-zoom1.png 등|원래 납품 CSV에 확인판도 포함. checks 경로 및 sourcePath=records/processing-and-preview.html|CSV runtimePath라는 열 이름만으로 런타임 에셋으로 오인하지 않음|
|Wave 30·32의 roof/snow 마스크|manifest의 마스크 참조 및 장부 ‘마스크(기록)’ 판정|눈 오버레이 최종 출력과 별개, 제외 유지|
|strip-corners 실제 모서리 16장|장부 비고의 눈가림 78%는 성적이며 파일 역할이 아님|앞선 조사에서 게임용에 포함, 제외하지 않음|

Steam 홍보용 최종 11장은 기술적 설치 가능성과 무관하게 이번 ‘게임용’ 범위 밖으로 분리했다. 외부 상점까지 설치 범위를 넓히면 이 11장은 별도 배포 큐이며, 확인판으로 폐기할 자료가 아니다.

원본 크기·시즌 짝·피벗은 분리 판정과 다른 단계다. 확인판 크기나 마스터 크기를 최종 스프라이트 크기로 빌려 쓰면 안 된다. 계절 이름이 없는 UI·초상·사건 삽화에는 겨울 짝을 임의 생성하거나 누락으로 세지 않는다. 실제 여름/겨울 대응은 납품의 그림별 설치 메타데이터에서 확인한다.
