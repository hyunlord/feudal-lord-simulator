# L1garden 후보 인계 — 실제게임 미검증

`final/`의7PNG는 body/snow/boarded/strained/neglected/vacant/plague-shut 후보다. builtin image_gen으로 본체5회와상태층6회를생성했으며 모든raw·정확prompt·실패를보존했다. 제품/장부/커밋/게시변경없음.

기하:139×175, 기존139² 위로36여백, scale0.498621726759907, pivot(71.66148325358851,161.92025518341308). 후보벽높이를올려큰문을수용했다. 전체집확대,부품조립,alpha클립,국소워프는하지않았다. 원본의작은박공초가·앞창/문·오른쪽정원/울타리/식생을시각적으로유지하되그림을다시그렸으므로기초모서리픽셀동일성은주장하지않는다.

수동판독:문잎높이42–43native(20.94–21.44world),개구부44–45native(21.94–22.44world),문잎폭17native(8.48world),개구부폭19native(9.47world). 각경계±1native판독오차,높이/폭합산±2native(±1.00world)를남긴다. 명목값은요구범위안이나하한여유가작아후속설치담당의독립측정필요. 정적수치통과로게임장면통과를대체하지않는다.

밝음/어두움7개별상태+neglected/plague/snow복합합성은qa/all-states-*.png. qa/original-candidate-measurement.png는원본+36여백,후보,문랜드마크비교다. 눈층은생성된초가지붕재료일부를포함하며벽/문을포함하지않는다. 본체밖62alpha>16픽셀은지붕눈경계에남겨두고최대거리를manifest에기록했다. 마스크로숨기지않았다.

소비계약:body exactlegacyURL=assets/buildings/variants-wave2/house_l1_garden-v1.png;level1;year<1350. condition3종은worn/order0/house-condition정확분기,boarded와plague-shut는boarded/order10/plagueVacantfalse/true분기(둘다abandoned가드),snoworder20·springmelt. fresh/weathered로상태를합치지않음.

실제게임후속:자연저장에서정확Wave2L1garden선택집의문/17.6walker·바닥·정원·겹침을확인하고condition3종·vacant/abandoned구분·역병shutter·winter/melt·복합상태를확인할것. 기존fire/burnt폴백은범위밖한계로유지. 설치/승인완료표현금지.

## snow03 단일 교정 결과

기존snow-v2는갈색지붕재료포함으로실패판정·보존. 새snow03은눈덩이/그림자만전체생성하여uniform등록했다. 갈색틈은투명하게보이며색키제거나마스크clip없음. 수동roofROI2414px: alpha가중57.397%, binary(alpha>16)69.884%, alpha>=128기준57.746%. 60–80규칙에서binary는범위안이나가중하한실패이므로통과아님. qa/snow03-light.png 및-dark.png에alpha0/0.5/1/눈단독비교.

바닥3점은원본+36여백과후보의실제기초모서리를수동대응: (20,128)→(22,127), (68,150)→(70,149), (95,134)→(97,133). 각잔차(+2,-1)native,거리2.236native=1.115world; 각끝점판독오차±1.5native. bbox중심이나강제정합값아님. snow03-qa.json 및qa/floor-three-points.png에보존. 본체/다른층변경없음.

## 최종 선택 snow04

snow03 틈을유지하며builtin으로1회두께교정. 생성된눈경계를지붕처마에맞추는전체uniform등록(1118×1407→87×109,이동17,21)후고정ROI alpha가중67.602%,binary>16 79.329%. 선호가중65–70및두60–80범위충족. snow-v2/snow03은기록보존,manifest7역할의snow만snow04로선택. 본체/다른6역할PNG불변. qa/snow04-light.png,-dark.png및snow04-qa.json을최신근거로사용. 실제게임미검증상태유지.
