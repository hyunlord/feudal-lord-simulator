# Charter & Kin 홀드아웃 — 2026-10-03 KST

> 원본: Astra README.md(sha256 7fb8e0bae28e114d75143d450eef10ebc9dee69fd06a64935d7da0b92662190a), 링크 경로만 저장소에 맞게 고침(`report/expansion/…` → `../expansion/report/expansion/…`).

**고정판은 새 시험에서 여섯 모두의 목표를 입증하지 못했다.** [최종 성능·해석](report/holdout/PRECISION.md), [여섯 검출기 점수](report/holdout/score-final/METRICS.md). 교정판 문턱/소스/카탈로그/매칭 규칙은 변경하지 않았다. 게임 커밋·푸시도 없다.

|검출기|재현율|정밀도|
|---|---:|---:|
|경계|44.8%|14.3%|
|이음새|50.0%|100.0%|
|멈춘 사람|N/A|N/A|
|지붕·벽 겹침|N/A|0.0%|
|크기|0.0%|N/A|
|반복|N/A|0.0%|

엄격 공간 매칭 수치다. 경계FN16중10은실제경계를짚은선분과넓은GT의매칭실패,6은출력없음이다. FP전체를의미상거짓경보라고읽으면안된다. 지면FP42개는후보별사후재판독을하지않았고, 전체104후보중1개는사전ROI밖이라미평가다. 확정양성없는유형의N/A는성공이아니다.

기존미평가369개에서사전고정단순무작위50개를AI직접시각판독했다. **참36·오탐5·불확실9,정밀도72~90%**. 불확실을버린87.8%를대표수치로쓰지않는다. [표본·구간·한계](report/holdout/sample/README.md), [50개개별판정](report/holdout/sample/REVIEW_TABLE.md).

## 자료

- [검출전 정답·해시](report/holdout/TRUTH_FREEZE.json), [90개 주석](report/holdout/truth-combined.json), [고정 도구](report/holdout/FROZEN_TOOL.json)
- [새지도12장면 점수](report/holdout/score-fresh-maps/METRICS.md), [시간홀드아웃3장면 점수](report/holdout/score-temporal/METRICS.md)
- [15장면·300프레임 매니페스트](report/holdout/new/capture-dataset.json), [실제자산330개 해시](report/holdout/new/capture-assets.json)
- [주요관찰10개](report/holdout/TOP_FINDINGS.md), [지면후검토](report/holdout/GROUND_POSTREVIEW.md), [객체후검토](report/holdout/OBJECT_POSTREVIEW.md)
- [실행법·납품검사](report/holdout/USAGE.md), [검증기록](report/holdout/VALIDATION.json), [문서참조검사정책](report/holdout/LINK_AUDIT_POLICY.md)

강가seed3·4·5는정상UI미지원이다. 다른네땅×3seed=12장면, 강가1301년과도시1362·1407년은시간홀드아웃3장면으로분리했다. 같은지도계보/자산을공유하므로독립원인으로과장하지않는다. 비검사는100ms전제와600ms입력/물마스크의조건한계가있다.

## 이전 납품 누락 복구

[원래 확장 보고서](../expansion/report/expansion/OBJECT_MATCH_REVIEW.md)의 다음4개그림을원래상대경로·원본바이트그대로포함했다. 초기교정증거이며이번홀드아웃점수와혼합하지않는다.

- [옛 도시](../expansion/report/expansion/OBJECT_MATCH_exp-prenat1-city.jpg)
- [도시 상세](../expansion/report/expansion/OBJECT_MATCH_exp-seed1-ch5-detail.jpg)
- [seed4 중기](../expansion/report/expansion/OBJECT_MATCH_exp-seed4-middle.jpg)
- [실타래 계수](../expansion/report/expansion/OBJECT_MATCH_seed1_middle_copies.jpg)

원본PNG시퀀스는경량납품에서제외했고로컬에보존했다. ZIP에는원본해시·압축draw메타데이터·모든표본판정·접촉판·검출주석JPEG가있다. 새JPEG는전송용축소/재압축본이며[원본과전송해시](report/holdout/JPEG_DELIVERY.json)를기록했다. 판독/검출에는원본만썼다. source/config/tests는이전납품바이트이며, 과거도구설명문서는중복재게시하지않고이번사용법으로대체했다. 서버4470은종료됐다.

최종 [문서 참조 검사 결과](report/holdout/LINK_AUDIT.json)와 ZIP 루트 SHA256SUMS를 제공한다.
