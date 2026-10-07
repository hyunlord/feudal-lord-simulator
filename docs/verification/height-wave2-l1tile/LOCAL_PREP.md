# L1tile 로컬 설치 준비

제품 worktree: /tmp/astra-height-wave2-l1tile-install
Base47fb0fdb + 공용 관리층 의존 c76127f의 cherry-pick ac7dd295.

실제 제품 변경은 catalog JSON 한 묶음과 source/runtime PNG7장 및 근거/장부다. 렌더 함수 새 분기·엔진·저장 형식·UI 변경 없음. 제품 설치 준비는 로컬이며 DGX·실제 캡처·게시를 하지 않았다. 의존 커밋 이후 로컬 인계 커밋으로 보존한다. 본선 게시 전 단계다.

원본 chapter2-war1340.json.gz의 construction-site-000021(50,39)과 기존 완성 석벽을 그대로 쓴다. 원본부터 해당 집은 성벽 내부다. 기존 Wave26/Wave2 선택기를 seed1..256 범위로 조회해 seed23에서 Wave26 null·Wave2 tile을 확인했다. prepared QA 저장의 seed만23으로 바꾸며 실제 벽/집 배치/배열/워커/인물/경로는 바꾸지 않는다. 원본 대비 seed 변동이 다른 장식에 영향을 줄 수 있으므로 전후에 동일 prepared 저장을 써야 한다.

prepare.mjs: 원본→10상태 준비 저장, 기존 buildBuildingVisualState·houseBodyAssignments·frameBuildingVariant를 거쳐 실제 legacyURL을 계약에 전달한다. codec 재열기 상태 동일성과 body/layer receipt를 확인한다. 이미지 준비는 모의 환경이므로 실제 브라우저 사용 증거가 아니다.

상태: maintained/strained(level0,builtLevel1)/neglected(unmet1200)/vacant/abandoned/plague-abandoned/winter/winter-abandoned/melt/melt-abandoned. 상태와 tick·seed·주민 members·plague 변경을 fixtures.json의 fields에 모두 기록했다. 준비값은 자연 사건/자연 계절 진행 증거가 아니다. town/person 집계까지 재조정한 시뮬레이션도 아니다.

capture.mjs·scene.mjs는 기존 공식 캡처 하네스를 복사해 외부 폴더에 경로를 맞춘 준비본이다. node --check 통과, 실행 안 함. 10상태×줌1/.6=20뷰를 그룹4상태씩 나눠 나중에 공식 --light에서 실행한다. 지금 Mac에서 브라우저 실행하지 않는다. 현재 절대 로컬 경로이므로 DGX 전송 때 실제 실행 staging 경로로 치환해야 한다. 이전 runtime 준비를 넘어 실제 사용 증거로 세지 않는다.

Mac: 관련43시험 통과, typecheck 통과, 범위ESLint 통과. 실제화면/최종test:changed/check:merge/기하는 아직이다. 최종게시 순서는 E→historic→Wave2이고 앞 게시를 합쳐 관문을 다시 수행한다.

장부: 기존6263행을 바꾸지 않고 새14행(registered7·보존 원시7)을 file바이트순 위치에 삽입. 제거하면 원본 전체바이트 동일. CRLF와 기존행순서 불변. installed_by는 registered7행만 local-prepared; 원시7행은 candidate·installed_by빈칸이며 게시 완료 표기가 아니다. 최종 증거 ledger-final-byte-audit.json. 원본 생성 원시7장은 inbox/raw에 바이트 그대로 보존하며 런타임 URL로 연결하지 않는다. 실패 시도 전체는 원래 후보 ZIP에 그대로 남는다.

기초 최대잔차1.40184world, 엄밀26.565° 미통과. 원본28.67°/30.07°, 후보30.83°/30.07°. 문21.42197×8.20060world±0.22315, 동일배율, 139×163/pivotY+24. candidate README의 한계를 그대로 유지한다.
