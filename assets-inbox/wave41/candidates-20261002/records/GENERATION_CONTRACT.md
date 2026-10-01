# Wave41 개별편집 실행 계약

선행 P0/P1 완료 확인: prerequisite-completion.json. 이제 이미지 생성 허용.

- 각담당은 할당번호만 책임진다. 다른작업자와공유중이므로 다른파일변경/되돌림금지. 재귀위임금지.
- records/ART_BIBLE_v2.md, INVARIANTS.md, scope.json 및 해당 records/prompts/NN.txt를 읽는다. source는설치원본, lock_reference는이폴더상대경로. 각편집전 view_image로원본과참고실물확인.
- 내장 image_gen 도구를실제로사용하여 각자산하나씩편집. 참조1은 geometry원본, 참조2는소재/화풍만. 정확한원본배치/여백/접지/실루엣고정. 이미지콜라주생성금지. API/CLI대체금지. 원본별1차출력검수후필요시재시도.
- 도구탐색은 ALL_TOOLS imagegen 필터. functions.exec 첫 pragma yield_time_ms120000으로호출, 끝나면 generatedImage(result). 원본출력경로와완전프롬프트를저장; base64로그노출금지. 모델/seed미제공이면null로기록,추정금지.
- tool출력파일은 raw/NN-attemptN.png에보존. 필요mkdir. generatedraw는경량ZIP에서제외. records/generations-NN.json에 prompt,references(absolute paths+hash),raw_source_path,raw_copy,attempt,tool,model,seed,inspection 기록. 반환metadata형식이불명확하면키/짧은필드만확인.
- 최종후보는 assets/{scope.output_name}. Sharp로원본캔버스크기에한번축소가능. 원본피벗/알파실루엣보존계약우선. 생성형상불일치를단순crop/trim으로숨기지말고기록하고고친다. 원본alpha재적용등명시적geometry보존후처리가필요하면기록하고시각검수; no fake pass.
- 별도 검수판을 proofs/lane-{담당}/에 원본/후보나란히 만들고직접view_image로검수. 런타임미설치,오프라인검수만.
- 게임제품코드/기존원본/공유scope.json수정금지. 담당자산 외변경금지. 세부프롬프트수정은 records/generations-NN.json에실제콜내용으로기록.
- 완료후각후보 경로,개수,기하유지상태,잔여위험을root에보고. 확실하지않은보존을통과주장하지않는다.

Sharp available: /Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js
