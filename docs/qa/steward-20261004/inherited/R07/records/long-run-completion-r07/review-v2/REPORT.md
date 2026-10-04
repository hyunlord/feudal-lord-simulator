# 장기 판 종료 검사기 V2 독립 검수

**PASS_BOUNDED_CHECKER_V2** — 수정 전 지적한 6개 반례를 모두 차단한다. 검사기 SHA256: `5d669b28e48b5ee739b4f61795411d684ca842714f313e56faf7fa6a33df9a0d`.

모든 새 fixture에는 실제 N02 start.fls.json을 넣었다. 시작 파일 누락으로 우연히 실패한 사례는 없다. N02 원본, 추가 진단 로그, findings가 있는 완료 판의 양성 3개는 통과했다. 변조·누락 음성 11개는 모두 exit1/FAIL_COMPLETION이며 해당 가드가 false임을 별도로 검증했다. baseline은 부모 CALIBRATION_N02_V2의 22개 체크·150행·38로그·최종 요약과 일치한다.

| 반례 | 확인한 실패 가드 |
|---|---|
| 최종 금고만 변경 | actual_start_final_hash |
| 해시 필드 모두 삭제 | required_hashes, actual_start_final_hash |
| 실제 최종 dues999 | actual_start_final_controls, actual_start_final_hash |
| codec 로그 final만 남김 | scheduled_save_logs, actual_start_final_hash |
| annual.year/exclusive 오염 | annual_calendar |
| metadata HEAD/config 오염 | run_config_identity, config_metadata_summary |
| final 로그 중복 | actual_start_final_hash |
| 시작 seed 오염 | start_identity, actual_start_final_hash |
| 실제 시작 방침 오염 | actual_start_final_controls, actual_start_final_hash |
| 최종 scenario 오염 | scenario_identity, actual_start_final_hash |
| 중간 로그 양쪽 해시를 동일한 비hex로 변경 | required_hashes |

원시 state JSON을 추출하고 파싱 결과를 비교한 뒤 SHA를 계산하므로 Ruby와 JS 숫자 재직렬화 차이에 기대지 않는다. 필수 64hex·유일 시작/최종 로그·실제 agency·달력 경계·예정 checkpoint·고정 실험 config 결합이 들어갔다. 새 형식의 저장은 추출 실패로 종료하며 범용 저장 변환기로 쓰는 계약이 아니다.

검사기는 완료 판의 일관성 검사다. findings가 있어도 완료 여부와는 별개이므로 추가 진단 및 findings 양성 통과는 적절하다. summary 인구·금고·사망 요약은 출력되지만 여기서 실제 state에서 독립 재계산하지 않는다. header checksum의 실제 codec 재검증, 모든 중간 저장 decode, every-tick 전불변식, 재미/UI를 증명하지 않는다. 원격 종료코드가 해당 run에 속한다는 연결은 부모 실행 메타데이터의 책임이다. 이 검수의 exit-zero.txt는 합성 보정 입력이다.

실제 seed3 실행 증거는 이번 검수에서 열거나 판정하지 않았다. 로컬 Ruby JSON 검사만 실행했다. N02 원본 7파일 SHA 불변을 확인했고, 기존 review/와 부모 checker는 수정하지 않았다. fixtures의 변경 없는 입력은 원본을 가리키는 심볼릭 링크이며 COUNTEREXAMPLES.json이 그 해시를 보존한다. SHA256SUMS는 이 폴더의 정규 파일만 포함한다.
