# 재현율 회차 읽기 전용 검토

검토 시점: 2026-10-02, wall_overlap 통합 및 최종 재집계가 진행 중인 중간 상태. 코드·시험지·보고서는 수정하지 않았다. 작성 파일은 이 문서 하나다.

## 상위 위험 3개

### 1. 높음: 양성 중심의 작은 ROI 정밀도를 전체 화면·커밋 자동 게이트 성능으로 표현하면 과대 주장

- 근거: `vision_check/benchmark.py:138`부터 후보 중심이 annotation.regions 안에 있는 경우만 채점한다. 밖의 후보는 159행 이후 excluded다.
- `truth-historical-frozen.json`은 고정 손님 5명의 22×22px 상자와 작은 통행 음성 ROI만 지정했다. `score-enhanced/METRICS.md`의 현재 중간 결과는 멈춘 사람 TP5/FP0인데 excluded_candidates가157이다. 지붕도 TP2/FP0 대 제외61이다.
- 이 수치는 ROI 안에 대해서는 맞지만, 검출 전체의 precision 100%를 뜻하지 않는다. 양성 옆의 좁은 ROI 위주 선택은 전체 화면 오탐을 대부분 분모에서 제외한다.
- 조치: 최종 표 제목을 **동결된 판독 ROI에서의 정밀도·재현율**로 한정하고, 평가 후보/전체 후보 및 제외 수를 같은 표나 바로 아래에 제시한다. 6종 모두 목표 달성·전 화면 신뢰성·자동 CI 차단 가능으로 일반화하지 않는다. 별도 전 후보 사람 판정이나 더 넓은 완전 주석 음성 화면이 있어야 그 주장을 할 수 있다.

### 2. 중간: 공간 IoU는 의미·프레임의 일치를 증명하지 않음

- 근거: `vision_check/benchmark.py:37` `_matches`는 상자 중심·IoU·상자 내부 비율만 확인하고, `benchmark_models.py`의 Defect에는 frame/event identity가 없다. Finding의 `measurement_frame`은 그림 선택에 쓰이지만 채점에는 쓰이지 않는다.
- 실제 발견된 사례는 실타래 GT 영역을 에일 통 군집의 큰 상자가 겹쳐 자동 TP로 잘못 연결할 수 있다는 점이다. 수동 `rejected_candidate_ids` API는 이 특정 실패를 막도록 구현되어 있고 검증되었다.
- QA005 새 정답은 frame16의 이동 인물 사건이다. 같은 공간의 다른 시간·다른 대상 검출을 자동 TP로 간주할 가능성은 일반적으로 남아 있다. 현재 정답은 동일 벽 위치를 **20프레임 중 한 번이라도 나타나는 공간 결함 1곳**으로 정의했으므로 이 정의를 결과에 유지해야 한다.
- 조치: 최종 TP 매칭마다 의미상 동일 결함인지 직접 확인하고, 수동 거절 ID 파일을 반드시 평가 실행에 전달한다. QA005 주석 이미지는 measurement_frame에 해당하는 실제 프레임을 사용한다. 시간 단위 재현율을 주장하려면 추후 typed ground-truth frame/event 범위가 필요하다.

### 3. 중간: 중간 집계 파일은 새 QA005·수동 거절을 아직 반영하지 않은 상태

- 검토 시점 `truth-combined.json`에는 `QA005-original-not-reproduced` 제외 항목이 남아 있고, 새 `truth-qa005-frozen.json`의 실제 재현 사건은 아직 결합되지 않았다.
- `score-enhanced/METRICS.md`는 지붕 TP2/FN0/제외정답1 및 반복 TP0/FN1을 표시하고, 수동 거절 규칙 설명이 없는 이전 출력이었다. 이는 작업 중 상태이므로 지금 코드 결함으로 단정하지 않는다. 이 상태를 최종 ZIP에 넣으면 최신 관찰과 숫자가 불일치한다.
- 조치: QA005 이전 제외 항목을 새 재현 항목으로 교체한 최종 결합 시험지, 정확한 최신 후보 파일, HUMAN_REPEAT_CANDIDATES.json의 실제 rejected_ids를 함께 재집계한다. 같은 최종 입력 파일 SHA256을 기록하고 MD·JSON·주석JPEG의 정합성을 확인한다. 옛 frozen 파일 자체는 수정하지 않는다.

## 추가 확인

- **0/0 처리 안전:** evaluate는 분모0을 None으로 두고, 두 지표가 모두 존재하지 않으면 met가 되지 않는다. 이미 존재하는 지표가 목표 미만이면 below_target이다. precision:null을100%로 치환하는 코드는 보이지 않았다.
- **미재현 분모 처리 안전:** eligible=False, reproduced=False는 FN에서 제외하고 excluded_annotations/excluded_defects로 기록한다. 새 QA005가 확인된 뒤에는 결합 시험지의 옛 제외 항목을 대체해야 한다.
- **거절 ID 처리 안전:** unknown ID는 ValueError, ROI 안 수동 거절은 FP, ROI 밖 거절은 excluded로 유지한다. 거절 목록은 metrics.json에 저장되고 MATCHES에 의미상 거절 사유가 나온다.
- **정답 좌표 하드코딩:** 검토한 ground.py, rock.py, figures.py, wall_overlap.py, objects.py, seams.py에 QA005 좌표(430~455,544,-2277), 장면 ID를 통한 양성 강제 분기는 발견하지 못했다. 장면 ID 사용은 결과 ID 구성·출력 이름이다. 재현기의 저장·카메라 지정은 검출 정답 하드코딩과 구분해야 한다.
- **게임 코드 편집:** 주 클론 및 wt-prenat1/wt-prenat2/wt-current의 `git diff --stat`은 모두 비어 있었다. 주 클론은 report/, tools/vision-check/, 각 worktree 디렉터리가 untracked이며, 일부 과거 worktree에 assets-inbox/endings-manors/가 untracked다. 새 분석도구·보고서·원본 자산 복원 외 기존 추적 코드 변경 증거는 없다. commit/push 이력 전체의 독립 감사까지 한 것은 아니다.
- **QA008 범위:** lod-comparison.json은 옛 먼줌 warning=true/candidates50, 현재 warning=false/candidates0을 보인다. 이 LOD 진단은 기본 6종 Detector에 들어가지 않아 동결 benchmark 표에도 없다. 별도의 알고 있는 양성 장면1·정상 장면1 비교로 명시해야 하며, 후보50개를 독립 TP50건으로 주장하지 않는다. 현재0건만으로 일반적 precision100%를 주장하지 않는다.
- **표본·조정 한계:** 같은 과거 저장의 여러 배율·프레임과 현재 알려진 결함에 맞춘 개선은 회귀 시험·교정 결과다. 독립 미사용 holdout의 통계적 성능 보장은 아니다. 타일 이음새 TP1 같은 작은 분모는 반드시 함께 표기한다.

## 판정

중간 구현의 핵심 분모·제외·중복 규칙은 보수적으로 설계되어 있다. 최종 패키지 전에는 위 1번의 주장 범위 제한, 2번의 매칭 의미 검토, 3번의 최신 입력 재집계를 완료해야 한다. 현재 전체 작업 완료/모든 목표 달성 여부를 승인한 문서는 아니다.
