# 조립기 독립 계약 검토

읽기 전용 검토. 조립기 수정은 담당자가 수행했으며 본 검토는 work/contract-review만 기록했다.

## 순위별 발견과 처리

1. **P1, 수정 후 재검증 통과**: 서로 다른 영지가 동일(300,300) 좌표여도 모든 checks=true였음. 숫자1/문자열"1"은 Set에서 별개지만 nodes에서 같은 키로 덮어썼고 __proto__ ID는 직렬화된 노드를 누락시킴. `input-cases.json`에 실제 재현. 담당자 수정 후 중첩/비문자열/예약어 모두 명시적 거절됨(`retest.json`). 최소55px 접지 거리만 검증하므로 실제 alpha/깃발 전체 점유의 무중첩 보장은 아님.
2. **P2, 담당자에 수정 요청 전달**: CLI에서 `--estates`로 제공한 JSON이 `{}` 또는 `null`이면 `input?.estates`가 undefined가 되어 사용자 데이터 오류를 기본12영지로 조용히 대체함. 명시적 입력 파일은 array 또는 object.estates array인지 검증해야 함. 라이브러리의 nonarray 거절 자체는 수정 후 통과.
3. **검증 범위 제한**: `noSettlementOnWater`는 중심 접지와 수로 거리/보수적 해안 한계, 호수 검사는 원형 근사이다. PNG의 실제 불투명 마스크와 충돌을 픽셀 단위로 입증한 결과가 아니다. `crossingsExplicit`는 실제 계산으로 바뀌었고 하드코딩 true는 현재 geometry에서 발견하지 않음. 다만 도하 마커 중심12px 이내 존재 여부이며 도로폭·둑·도하 그림의 투명 영역 전체가 실제 통과로 연결되는지는 별도 시각 검증 필요.

## 통과 증거

- `test.cjs references/neighbor-world.json --render`: PASS17cases, 5유형×3seed 결정론/연결/수역검사 및 원본18영지 좌표·네트워크 깊은 동일성, 같은 프로세스 이미지/메타데이터 결정론 통과.
- 별도 두 프로세스 cli seed17/open_field: JPG와 JSON 모두 byte-identical(`retest.json`). JPG SHA256 `b5e821c3fe7830e88b41a4c6abd8e8a84d727e63d6f312b86e23837a342138be`. 결과 `process-a.*`, `process-b.*`.
- estates=[]는 명시적1~30개 요구 오류, 1영지는 정상, 부분 좌표와 경계 밖은 테스트상 거절됨.
- 15기본 표본의 각 도하 중심과 angle/span으로 계산한 양 끝은 수로 내부에 남지 않았음(`bridge-span.json`: []). 사용자 좌표2개/100seed 검사에서도 생성에 성공한85개는 침수된 도하 끝0건;15개는 물에 걸려 명시적으로 거절됨(`custom-bridge-span.json`). 이는 그림의 실제 alpha 길이까지 보장하지 않음.
- 초기 소스 대비 진행 중 담당자 수정이 있었으므로 재검증 geometry SHA는 `retest.json`에 별도 고정함.

참고: `test.cjs --render`만 실행하면 스크립트가 첫 인자를 neighbor 경로로 읽어18영지 시험을 건너뛴다. 반드시 위처럼 neighbor 경로를 명시해야 해당 시험이 포함된다.
