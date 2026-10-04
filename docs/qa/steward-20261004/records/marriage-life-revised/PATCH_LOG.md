# 혼인 문맥 선택기 최소 수정

독립 marriage-life-review에서 원래 schema는 추가 unexpectedHistoricalCause를 거부했으나 참조 선택기가 schema를 거치지 않아 후보를 골랐다. 별도 수정본의 select_candidate는 네 번째 인자로 CONTEXT.schema.json을 받고 가장 먼저 validate_schema를 실행한다. 실패는 nil/baseline fallback이며 후보 조건에 도달하지 않는다.

원래 문장20개·fixture166개·schema 음성검사114개·사실줄 차단3건을 보존한다. 필드6개 중 willAllowedRoute의 사망 가드만 후속 검수에 따라 강화하며 나머지5개 계약은 보존한다. 회귀52개는 양성 enum26개마다 fields 내부와 envelope 바깥에 허구의 추가필드를 넣는다. 모두 schema 거부와 selector fallback을 함께 요구한다.

SCHEMA_GATE_REGRESSION.json 및 VALIDATION.json은 작성자 로컬 Ruby 결과다. 독립 재검수는 아직이며 엔진·정본·원본·다른 검수 폴더는 수정하지 않았다. strict schema가 실제 event record와의 관계 또는 캡처의 사실성을 증명하지는 않는다. 원래 h-test/1000 모델의 한계와 사용차단3건은 유지한다.

추가 검수 반영: contested2의 willAllowedRoute 계약에 실제 oldLord 존재·계약 당시 신부 아버지ID 일치·사건 시점의 사망근거 확인을 명시했다. source의 missing oldLord→!alive를 사망 증거로 쓰지 않고 unknown/fallback으로 보낸다. 이로 인해 FIELD_CONTRACTS/PROPOSAL의 해당 captureRule 및 schema의 계약 enum만 확장했다. 문장20개와 fixture166·114, 사실줄3홀드는 그대로다. 원래 계약6개 중 이 필드의 가드 추가 외 변경이 없음을 validator가 확인한다. 가드 실행 어댑터는 여전히 미구현이다.
