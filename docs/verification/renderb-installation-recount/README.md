# 설치 회계 현재 재검산 — 9786468f

**정적 재검산 PASS. 신규 런타임·설치 완료 판정 아님.**

기준 HEAD: `9786468f72c67e6c206a708b60d0fa69e0d6001e`. 원래 설치/교체 대상 744개와 그 안의 계약 감사 부분집합 425개 ID를 그대로 유지했다. 원본 inventory 전체 803행 중 장부 대조만 하는 59행은 744 분모 밖이다. 425는 744에 더하는 수가 아니다.

## 상태와 분모

| 범위 | 분모 | marked | active-unproven | byte-proven-unmarked | retired | superseded |
|---|---:|---:|---:|---:|---:|---:|
| 전체 원래 대상 | 744 | 206 | 515 | 4 | 17 | 2 |
| 계약 감사 부분집합 | 425 | 157 | 248 | 4 | 16 | 0 |

marked = 현재 installed_by 표시. active-unproven = 과거 감사에서 활성이나 설치 입증이 부족한 항목이며 미설치라는 뜻이 아니다. byte-proven-unmarked = 공개 별칭 바이트는 확인했지만 설치 표시가 없는 항목. retired/superseded는 현재 장부 상태다.

## 원래 단계별 상태 (전체 744)

| 원래 단계 | 분모 | marked | active-unproven | byte-proven-unmarked | retired | superseded |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 298 | 92 | 201 | 4 | 1 | 0 |
| 2 | 178 | 82 | 80 | 0 | 16 | 0 |
| 3 | 268 | 32 | 234 | 0 | 0 | 2 |

단계는 원래 priority_stage를 보존한 것으로 현재 실행 순서나 data-ready 판정이 아니다.

## 소비 화면 소유 (부분집합 425)

| 기존 consumer_owner | 개수 / 425 |
|---|---:|
| Render A placement/input feedback consumer in world coordinates; Render B asset data/install | 4 |
| Render A screen/input consumer; Render B contract/files/install | 156 |
| Render B world consumer | 232 |
| Render B world consumer; Render A LM-R1 UI collaboration | 32 |
| World carved mark/material consumer boundary unresolved; not exclusive Render A | 1 |

425개 모두 기존 asset_contract_install_owner는 Render B다. Render A 화면/입력 156개와 세계 좌표의 배치/입력 피드백 4개는 Render A 소비 경계다. 이를 새 엔진 요구나 Render B 세계 설치 완료로 세지 않는다. 세계 소비+LM-R1 UI 협업 32개도 별도로 남겼다.

## 직접 확인한 변경과 보존

- ed83: 전체 marked 202, active-unproven 519, retired 16, superseded 2, byte-proven-unmarked 5. 부분집합 marked 153, active-unproven 252, retired 16, byte-proven-unmarked 4.
- c203: REGION4 I0709/I0710/I0711/I0716 (N0411/N0412/N0413/N0418)의 표시 반영으로 marked +4, active-unproven −4.
- 32a599: LR1-D1의 I0656 seal 퇴역 반영으로 retired +1, byte-proven-unmarked −1. 425 분모 밖이므로 부분집합 불변.
- 9786468f 현재: 32a599 대비 상태·ID·설치 표시 변경 0. 원본 744개 SHA, 현재 장부 6,122행의 해당 유일행, 기록된 공개 별칭 210개 바이트 및 현재 provenance 일치 재확인.
- ed83/c203/32a599 JSON은 바이트 그대로 history 파일에 보존했다. 과거 가용성/역할 해석을 현재 승인으로 다시 선언하지 않는다.

## 런타임 경계

- 정적 장부/원본/기록된 공개 별칭 재검산이며 새 runtime 관측이 아니다.
- marked는 installed_by 표시이며 새 runtime PASS가 아니다. active-unproven은 미설치 단정이 아니다.
- REGION4는 분리 체크아웃 proof와 장부 표시가 있다. 현재 통합 batch 수락은 이 패키지에서 pending으로 유지한다.
- CLOUD N0354/N0355는 HOLD이며 DATA 가시성 수락이 없다. CORE 기존 두 그림의 이동만 별도 입증되었다.
- 계약/파일 설치 소유와 UI 소비 화면 소유를 구분한다. 과거 가능성 분류를 지금 data-ready로 승격하지 않는다.
- I0656 seal retired는 LR1-D1 상태 결정이다. 남아 있는 공개 별칭 바이트가 퇴역을 취소하지 않는다.

REGION의 공식 분리 실행 증거는 `docs/verification/region-spring4-data/REPORT.md`, CLOUD HOLD는 `docs/verification/cloud-data2-hold/REPORT.md`에 있다. 현재 통합 실행의 별도 수락은 이후 배치 증거로 갱신해야 한다. 본 패키지는 그 관문을 대체하지 않는다.

## 기계 판독 자료

- [rows.json](rows.json): 정확한 744 I-ID/425 N-ID, 기존 상태·단계·별칭.
- [source-provenance.json](source-provenance.json): 원본 감사/장부/provenance 입력 SHA, 별칭 210개, 소유별 ID와 상태.
- [historical-ed83.json](historical-ed83.json), [historical-c203.json](historical-c203.json), [historical-32a599.json](historical-32a599.json): 수정하지 않은 역사.
- [SHA256SUMS.json](SHA256SUMS.json): 자기 자신을 제외한 패키지 전체 파일 SHA/크기.

원본·공개 그림·장부·제품 변경 0. 브라우저/원격/새 캡처 실행 0.
