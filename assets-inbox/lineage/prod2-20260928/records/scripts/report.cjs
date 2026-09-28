const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(base,'records',f)));
const blind=read('blind-results.json'),qa=read('technical-qa.json'),age=read('age-review.json');
const text=`# 혈통 본 제작 2차 검수 보고

최종 후보114장(세 가문 각38장), 확인 그림4장, CSV114행. 게임에 설치하지 않았다. 독립 AI 시각 검수이며 사람 대상 실험이 아니다.

## 시각 판정

| 검사 | 결과 | 조건·한계 |
|---|---|---|
| 익명 가족 묶기 | ${blind.family.correct}/30 | 요구80%, ${blind.family.pass?'통과':'미달'}. 머리·복식도 보이므로 얼굴만의 친족 판독으로 해석하지 않는다. |
| 같은 사람인가 | ${blind.identity.correct}/18 | 형제9쌍·동일인9쌍, 청년↔장년 포함. ${blind.identity.pass?'전부 일치':'오판은 records/blind-results.json 참조'}. |
| 96px 동일인 보조판 | ${blind.identity.actual96px?.correct??'미측정'}/18 | 작은 화면에서의 별도 판정. |
| 옷만 보고 계급 | ${blind.costume.correct}/30 | 얼굴·머리를 제외한 동일128×66 하단 의복 범위. L3·L7은 젠트리 한 계급. |

연령 검수는256px와96px에서 수행했다. 판독 연령은 추정치이며 정확한 생물학적 나이를 보장하지 않는다. 파일별 PASS/REVIEW/FAIL·추정 범위·검수 시점 해시는 records/age-review.json에 있다. 어린이의 청소년 같은 얼굴 비례와 일부 장년의 약한 노화를 발견해 교정했으며, 수정 전 생성물은 별도 전체ZIP에 보존했다.

## 기존 세력 수장 연결

- I101/I102 → L6_101/102, I107/I108 → L7_101/102: 청년·장년·노년12장 원본 바이트 재사용.
- I103 → L6_201: 청년·장년2장 원본 바이트 재사용. 전체14장 해시 일치, 신규100장.
- 원본 노년이 이미 있으므로 중복 생성하지 않았다. 기존24→45(+21년)는 승인 원본 예외이며 신규는+20년이다.
- I103 기존 짙은 금발과 I102 기존 녹색 의복도 유지했다. 유전·복식 규칙 때문에 승인 얼굴을 바꾸지 않았다.

## 제작·기술 검수

114장 모두256×256. 신규100장은RGBA, 재사용14장은 원본 채널 형식까지 그대로 유지했다. 기존 승인 원본${qa.approvedOriginalsUnchanged}장 해시 불변. 새 후손 생성의 실제 양친 입력, 프롬프트·원본·참조 해시, 형질3개·차이 표식3개 이상을 검사했다. CSV는114행20열 전체 셀 왕복 검증. 수치 검증은 시각 판독의 대체물이 아니다.

담비는L6에만, L7은여우·다람쥐 계열 젠트리, L8은튼튼한 모직·가죽 앞치마·밀가루 자국을 사용했다. 기혼 성인 여성 머리 가림과 아기 보닛·포대기는 연령 검수에서 확인했다.

## 납품 범위

경량ZIP은 최종PNG·확인판·CSV·TRAITS·프롬프트·검수 기록을 담는다. 고해상도 원본과 반려 시도는 저장소 밖 astra-raw의 별도 전체ZIP에만 담는다. 실제 게임 렌더링·교체·저장·런타임 성능 검증은 이번 후보 제작 범위가 아니다.

개별 초상은 IMAGE_LINKS.md, 네 확인 그림은 proofs/에서 연다. 기록에 남은 절대 raw 경로는 전체ZIP의 lineage-prod2-20260928/에 대응한다.
`;
fs.writeFileSync(path.join(base,'REPORT.md'),text);
console.log(JSON.stringify({report:'REPORT.md',ageSummary:age.summary}));
