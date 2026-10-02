# Wave41 환경 스타일 참고 준비 검수

2026-10-02. 이미지 생성·편집·설치 없음. 소스/프롬프트 수정 없음. 영주 P0/P1 완료 전 생성 금지 상태를 유지한다.

## 읽은 계약

- `/Users/rexxa/orca/workspaces/feudal-lord-simulator/galeocerdo/output/astra-wave41-candidates-20261002-v1/records/scope.json`: 전체29개 항목 및 환경13개 범위 확인.
- `/Users/rexxa/orca/workspaces/feudal-lord-simulator/galeocerdo/output/astra-wave41-candidates-20261002-v1/records/prompts`: 01~29.txt 전부 읽고 중복 문구 제거 방식으로 모든 고유 지시를 확인.
- `/Users/rexxa/orca/workspaces/feudal-lord-simulator/galeocerdo/output/astra-wave41-candidates-20261002-v1/records/ART_BIBLE_v2.md`: 사용자 채택본 및9절 예외 우선순위 확인.

환경 담당 대상은 05~10 건초6개, 11~14 과수4개, 15~16 울타리2개, 24 바위1개다. 고정 원본 Input1은 각 scope.lock_reference이며 아래 파일은 재료/붓질 참고 Input2의 후보일 뿐 형상 대체용이 아니다.

## 실물 확인한 프로젝트 내부 참고

### 건초 주참고

- 설치 파일: `/Users/rexxa/github/fls-landui/public/assets/wave28/prop/haystack_summer.png`
- 대장 sourcePath: `/Users/rexxa/github/fls-landui/assets-inbox/wave28/candidates-20260928/assets/haystack_summer.png`
- status: `runtime`; source 파일 존재 및 설치본과 동일 SHA 확인.
- SHA256: `f25afa933ebbf5091dad06a4b3f61cf8b31c8ec20fce813332e00537ccd2ffa5`
- 실물 검토: 개별 원본을 view_image로 열어 확인. 따뜻한 황갈색 섬유가 중간 크기 다발로 겹치며 적당한 불규칙 결을 보인다. 05~10의 민무늬 면 내부에 이 결의 방향·명암단계를 적용한다.
- 차용 금지/주의: 중앙 말뚝·원뿔 형태·바닥 길이·표면 밖 잔가지 끝은 가져오지 않는다. 고정 실루엣 내부 재질만 참조.

### 건초 보조

- 설치 파일: `/Users/rexxa/github/fls-landui/public/assets/wave28/prop/haystack_autumn.png`
- 대장 sourcePath: `/Users/rexxa/github/fls-landui/assets-inbox/wave28/candidates-20260928/assets/haystack_autumn.png`
- status: `runtime`; source 파일 존재 및 설치본과 동일 SHA 확인.
- SHA256: `f58024d2a3046a5092acf9a8151870525046f3d99f8c22d0967dd32d4a6502e3`
- 실물 검토: 개별 원본을 view_image로 열어 확인. 더 건조한 옅은 볏짚 색과 길게 겹친 다발을 비교해 섬유가 금속광택/모래처럼 되지 않게 한다.
- 차용 금지/주의: 계절 색을 그대로 덮거나 건초 여섯 더미를 이 원뿔 한 형태로 바꾸지 않는다.

### 과수 유일한 재료 참고

- 설치 파일: `/Users/rexxa/github/fls-landui/public/assets/wave28/prop/oak_solitary_summer.png`
- 대장 sourcePath: `/Users/rexxa/github/fls-landui/assets-inbox/wave28/candidates-20260928/assets/oak_solitary_summer.png`
- status: `runtime`; source 파일 존재 및 설치본과 동일 SHA 확인.
- SHA256: `b3c506ba65c937e260fd3311235566c29005c2bfb33d0dd1abfa413683167d12`
- 실물 검토: 개별 원본을 view_image로 열어 확인. 큰 수관 안에 작은 잎뭉치와 제한된 잎 끝으로 재료를 읽히게 하는 손그림 붓질·명암 밀도를 확인했다. 11~14의 내부 잎질감만 참고한다.
- 차용 금지/주의: 참나무 종·전체 크기·가지 배치·뿌리·잎 실루엣은 가져오지 않는다. 기존 사과/배/자두 종 및 색·기존 가지 좌표 보존. orchard g/h는 개선 기준으로 사용 금지.

### 울타리 주참고

- 설치 파일: `/Users/rexxa/github/fls-landui/public/assets/yards/hurdle_gate-v1.png`
- 대장 sourcePath: `/Users/rexxa/github/fls-landui/public/assets/yards/hurdle_gate-v1.png`
- status: `runtime`; source 파일 존재 및 설치본과 동일 SHA 확인.
- SHA256: `b51749af62f59d82cd4c4d3faf42d95c0a7aa048f7e94320cb0c25c5f7ff1579`
- 실물 검토: 개별 원본을 view_image로 열어 확인. 같은 설치 hurdle 세트의 마모된 기둥 끝, 목재결과 따뜻한 갈색 중간톤을 15~16의 매끈한 평면과 비교한다.
- 차용 금지/주의: 문/걸쇠 구조를 추가하지 않는다. 참고 밝은 노랑 하이라이트를 전면으로 확대하지 말고 ART_BIBLE 참나무 중간톤도 함께 적용.

### 울타리 연결부 보조

- 설치 파일: `/Users/rexxa/github/fls-landui/public/assets/yards/hurdle_corner_e-v1.png`
- 대장 sourcePath: `/Users/rexxa/github/fls-landui/public/assets/yards/hurdle_corner_e-v1.png`
- status: `runtime`; source 파일 존재 및 설치본과 동일 SHA 확인.
- SHA256: `66f0fa08db83db46cb1f4c6cfa218a03283631cc6a403d76d4bed8ad5a398497`
- 실물 검토: 개별 원본을 view_image로 열어 확인. 코너 연결부의 같은 목재 질감, 기둥 단면의 음영과 레일 접촉 어둠을 확인했다.
- 차용 금지/주의: E형 코너 각도나 레일 개수로 대상 straight/end_corner를 교체하지 않는다. 기존 기둥/레일 위치와 단면 경계 고정.

### 바위 주참고

- 설치 파일: `/Users/rexxa/github/fls-landui/public/assets/wave22/props/sheep_stone_wall_a.png`
- 대장 sourcePath: `/Users/rexxa/github/fls-landui/assets-inbox/wave22/candidates-20260927/assets/props/sheep_stone_wall_a-v1.png`
- status: `runtime`; source 파일 존재 및 설치본과 동일 SHA 확인.
- SHA256: `667fe4bb213275cc65951f98a9a0a9055d4fc0251e8b80f8d0b9e36fb8a9f78a`
- 실물 검토: 개별 원본을 view_image로 열어 확인. 회갈색 돌 면의 중간 덩어리·약한 이끼·과도하게 검지 않은 이음 음영을 확인했다. 24 rock의 고주파 이끼와 검은 틈 대비를 누르는 참고다.
- 차용 금지/주의: 돌담으로 변환하거나 돌의 윤곽/배치를 복사하지 않는다. 타일 원본의 모든 돌 형상·틈 좌표·4변 경계 보존.

### 바위 보조 참고

- 설치 파일: `/Users/rexxa/github/fls-landui/public/assets/wave22/props/chalk_outcrop_a.png`
- 대장 sourcePath: `/Users/rexxa/github/fls-landui/assets-inbox/wave22/candidates-20260927/assets/props/chalk_outcrop_a-v1.png`
- status: `runtime`; source 파일 존재 및 설치본과 동일 SHA 확인.
- SHA256: `979691201311908d39b1965751e61e91c88eaf78b403c754f25b69b1938e0b80`
- 실물 검토: 개별 원본을 view_image로 열어 확인. 돌의 넓은 면과 따뜻한 회색/베이지 명부가 사진성 미세 잡음 없이 읽히는 방식을 참고한다.
- 차용 금지/주의: 흰 석회암 지질을 강제하지 않는다. 원본 전체를 백색으로 덮지 말고 면의 붓질·대비 절제만 참조. 흙/풀을 추가하지 않는다.

## 환경13개 적용 매핑

| 번호 | 대상 설치 경로 | 참고 |
|---|---|---|
| 05 | `public/assets/zones/haycock_a-v1.png` | Wave28 haystack_summer (+ autumn) |
| 06 | `public/assets/zones/haycock_b-v1.png` | Wave28 haystack_summer (+ autumn) |
| 07 | `public/assets/zones/haycock_c-v1.png` | Wave28 haystack_summer (+ autumn) |
| 08 | `public/assets/zones/haycock_d-v1.png` | Wave28 haystack_summer (+ autumn) |
| 09 | `public/assets/zones/haycock_e-v1.png` | Wave28 haystack_summer (+ autumn) |
| 10 | `public/assets/zones/haycock_f-v1.png` | Wave28 haystack_summer (+ autumn) |
| 11 | `public/assets/zones/orchard_apple_c-v1.png` | Wave28 oak_solitary_summer (재료 붓질만) |
| 12 | `public/assets/zones/orchard_apple_d-v1.png` | Wave28 oak_solitary_summer (재료 붓질만) |
| 13 | `public/assets/zones/orchard_pear_e-v1.png` | Wave28 oak_solitary_summer (재료 붓질만) |
| 14 | `public/assets/zones/orchard_plum_f-v1.png` | Wave28 oak_solitary_summer (재료 붓질만) |
| 15 | `public/assets/yards/hurdle_straight-v1.png` | hurdle_gate + hurdle_corner_e |
| 16 | `public/assets/yards/hurdle_end_corner-v1.png` | hurdle_gate + hurdle_corner_e |
| 24 | `public/assets/terrain/rock.png` | Wave22 sheep_stone_wall_a (+ chalk_outcrop_a: 붓질만) |

## 제작 전 확인 메모

- `EXACT original canvas aspect`만으로 픽셀 크기·alpha support·피벗 유지가 보장되지는 않는다. 기존 INVARIANTS 계약의 실제128×128/256×256/128×64/128×96/512×512 및 원본 alpha 경계 비교를 생성 이후 별도로 실행해야 한다. 본 준비는 이를 통과한 후보를 뜻하지 않는다.
- 과수의 질감 개선을 위해 silhouette 밖 잎을 추가하지 않는다. 잎의 내부 경계만 잘게 나누고 원본 가지/수관 좌표를 유지한다. g/h 역시 둥근 수관이므로 개선 기준에서 제외했다.
- 건초 참고에는 말뚝과 길쭉한 원뿔이 있지만 대상 원본에는 없다. 내부 섬유와 재료만 가져오고 새로운 말뚝/풀/접지 그림자 생성 금지.
- 울타리 gate/corner의 동일 세트 질감을 쓰되 문짝 구조와 조명 반전을 들여오지 않는다. 밝은 노랑 하이라이트의 과대 복제 주의.
- 바위 prompt24의 `rubble/chalk`는 회화적 면과 저대비 재료의 지침으로 해석해야 한다. 정확한 형상 보존 계약 아래 벽돌담이나 흰 석회암 덩어리로 지질/구조를 바꾸면 안 된다. 이 해석을 권고했으며 프롬프트 자체는 수정하지 않았다.
- 바위는 사각 불투명 fill이다. 생성 후4변의 원본 경계와 반복 seam을 검사한다. reference의 투명 소품 실루엣을 바위 타일로 가져오지 않는다.
- 수용 기준은 ART_BIBLE의 좌상광·큰 재료 덩어리·무검정 외곽선·한 번 축소다. 참고물의 작은 픽셀 잡음을 그대로 확대 복사하지 않는다.

준비 판정: 적합한 프로젝트 소유 참고7개를 실물 확인했고 환경13개에 대응시켰다. 생성은 미실행이며 선행 완료 대기 상태다.
