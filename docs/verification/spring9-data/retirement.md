# 옛6 퇴역과 새9 후보 — 70c 후보 커밋 시점 기록

V1 후보에서 남아 있던 옛 Wave15 봄 public 중복6을 승인 v2처럼 제거했다. 원본 inbox6은 삭제·수정하지 않는다. 해당 provenance6의 runtimePath는 보존 원본으로, status는 retired로 바뀌며 새9는 candidate다. 나머지2412 CSV레코드는 literal bytes가 같다. 정확한 전후 행은 retirement.json이다.

ID/version만 같은 기존 행이 있으므로 이전 검증과 최소 수정은 assetId/version/sourcePath의 고유한 조합을 사용했다. 전체 CSV를 재직렬화하지 않았다. 설치 장부·W37표시16은 변경하지 않았으며 새9의 installed_by는 아직 주장하지 않는다.
