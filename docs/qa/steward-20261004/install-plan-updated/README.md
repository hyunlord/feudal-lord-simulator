# R01 설치계획 갱신본

`ORDER.md`는현재실행순서,`INVENTORY.csv`는남은858장,`REMOVED.csv`는구판에서빠진142행,`EXCLUSIONS.csv`는confirmed·설치공란중게임설치대상외1,363행이다. `current_ledger_line`은현재HEAD의줄이고원래`ledger_line`은구판줄을그대로보존했다.

기존행의source/target/metadata/코드근거는원본계획에서보존했으며그대로최신API라고보장하지않는다. 새197행은받은원본경로·SHA·승인근거만정본이다. target_path와pivot등을아직정하지않은빈칸은원화누락이아니라연결계약미작성이다. 원본manifest의피벗을설치담당자가읽어변환해야하며임의기본값을채우지않았다.

경로는원저장소기준이다. 구판사양은`docs/ops/install-plan-20261003/`에서읽는다. CSV그자체를그대로설치하는실행스크립트가아니다. 공개원본이나코드는수정하지않았다.
