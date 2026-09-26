# Wave20 참조·기하 계약

후보 제작을 위한 계약입니다. 게임 설치·런타임 검증은 수행하지 않았습니다. `references/houses`의 원본 5장은 현재 playable 공개 에셋과 SHA-256까지 일치합니다. `references/overlays`의 10장은 Wave7 재작업 ZIP의 최신 v2와 SHA-256이 일치합니다. v2 메타데이터는 `candidate`, `pending user review`이며 명시적 최종 승인 증거는 없습니다.

## 좌표·배율

모든 CSV 행의 footprint는 **1×1**입니다. 아래 anchor는 PNG 내장 메타데이터가 아니라 현 렌더러의 기존 alpha crop 아래 중앙을 native 픽셀에 매핑한 값입니다. 분수가 정확값이며 소수는 표시용입니다. anchor가 논리 타일 중앙의 `(0,+16)` 화면 지점에 놓입니다. 원본 논리 좌표 캔버스는 모두1254×1254이고, 첨부 PNG는 해당 원본의 runtime derivative입니다.

| 단계 | native 캔버스 | anchor x 정확분수·소수 | anchor y 정확분수·소수 | native→world 배율, zoom1 | footprint |
|---|---|---|---|---|---|
| L0 | 153×153 | `16167/209` = 77.35406698564593 | `2652/19` = 139.57894736842104 | 0.4995704948646125 | 1×1 |
| L1 | 139×139 | `59909/836` = 71.66148325358851 | `78952/627` = 125.92025518341308 | 0.4986217267599071 | 1×1 |
| L2 | 137×137 | `59321/836` = 70.95813397129187 | `55211/418` = 132.08373205741626 | 0.4980801861842801 | 1×1 |
| L3 | 142×142 | `15549/209` = 74.39712918660287 | `86549/627` = 138.03668261562999 | 0.4983578424454543 | 1×1 |
| L4 | 161×161 | `205597/2508` = 81.97647527910686 | `98693/627` = 157.40510366826157 | 0.4979186553958305 | 1×1 |

본체·새 굴뚝·판자·눈 오버레이는 **동일 native 캔버스, 동일 anchor, 동일 배율, 추가 오프셋(0,0)** 을 사용합니다. 외곽 투명 여백을 자르거나 새 alpha bbox로 재중앙정렬하면 안 됩니다. 굴뚝으로 alpha 범위가 커져도 기존 집의 crop 폭/높이로 정해진 배율을 다시 계산하지 마십시오. 원본 지붕·문·창이 이동하면 기존 오버레이 호환도 깨집니다.

원본1254 alpha crop을 그대로 샘플링하면 새 굴뚝이 기존 crop 밖에서 잘릴 수 있습니다. 향후 설치 시 전체 native 캔버스 또는 확장 샘플 영역을 그리되 **기존 anchor·native→world 배율을 유지**해야 합니다. 전체 캔버스 top-left는 `anchorWorld - nativeAnchor * scale`로 구합니다. 이 패키지는 해당 런타임 변경을 수행하지 않습니다.

## 수치 근거

저장소: `/Users/rexxa/github/feudal-lord-simulator-playable`

`src/render/historicalHouseAssets.ts:71–75`:
```ts
const center = tileToScreen(building.tx, building.ty);
const width = TILE_W * 0.88;
const height = width * meta.alphaBounds.height / meta.alphaBounds.width;
return { x: center.sx - width / 2, y: center.sy + TILE_H / 2 - height, width, height };
```
`src/render/runtimeAssetCoordinates.ts:7,17,21–25`:
```ts
// Authored registrations stay in source pixels; only image sampling uses derivative pixels.
imageScales.set(image, { x: derivative.width / originalWidth, y: derivative.height / originalHeight });
// runtimeAssetCrop converts original-coordinate sampling rectangles:
x: source.x * scale.x, y: source.y * scale.y,
width: source.width * scale.x, height: source.height * scale.y,
```
`src/render/iso.ts:1–2`: TILE_W=64, TILE_H=32. `src/content/buildingConfig.ts:58–62`: 기본 house width=1,height=1. `src/render/historicalHouseAssetManifest.generated.ts`의 단계별 alphaBounds를 사용했습니다. houseLot 합필 주택은 이 계약 대상이 아닙니다.

정확식: `nativeAnchorX=(sourceCrop.x+sourceCrop.width/2)*nativeWidth/1254`, `nativeAnchorY=(sourceCrop.y+sourceCrop.height)*nativeHeight/1254`, `scale=56.32/(sourceCrop.width*nativeWidth/1254)`.

## 보존 해시

| 파일 | SHA-256 |
|---|---|
| `references/houses/house_l0-v3.png` | `fd1bfc4c4f79728490bf8a5c437bc4b9d78cad5ba97015f8ab83f4ebf21ecd09` |
| `references/houses/house_l1-v2.png` | `84424c358a5434821146ab7c8c260b3ad807595fface5018aff6b6211f2cd3ac` |
| `references/houses/house_l2-v2.png` | `57c717005bf698a915d2a19c42682a80b48f873c2a9226fc7f6b144a16a0c85e` |
| `references/houses/house_l3-v2.png` | `2c557c5345a568e1bf80e9ba7fdc9c3bfc5463b6706ffdb9c71e789f320d28dc` |
| `references/houses/house_l4-v2.png` | `b3f7e40cda9de09b2e0af0a596bb8b414b40fb037f46897ab0d4d3cb264d72b8` |
| `references/overlays/boarded_l0-v2.png` | `6d19cdb3d34039321ea09ab844b696a91b4e2265d041ba7ec523b916d48afaaa` |
| `references/overlays/boarded_l1-v2.png` | `175741dbcf5ebb62b4a9c8db46e9ef1c29e24a4ca005a97211eb33c33fd725e8` |
| `references/overlays/boarded_l2-v2.png` | `3b3e63fea713e6d5be4f0971b16002512fadd836924d9daf760e4311a21fb5d1` |
| `references/overlays/boarded_l3-v2.png` | `d7510229c8f432347f593e423ca079627f8337216abce85273e66b8104d2977a` |
| `references/overlays/boarded_l4-v2.png` | `6b0a042e586f96b316e9c3cf449ba189b010eaa08470a3c68005dbd2b6ca19a6` |
| `references/overlays/roof_snow_l0-v2.png` | `de6abd02053da883f3ee1000d60f57ba14e3f0d1b525272f02adaf186b24dc8c` |
| `references/overlays/roof_snow_l1-v2.png` | `812ba0165e63c0494370d4fe37c9635e86b674d8eb07add02f600f39fb92a42e` |
| `references/overlays/roof_snow_l2-v2.png` | `af53c4c70620f3de88bd957e65b908467fb1939ce95cc06c1eca42a6bcac4043` |
| `references/overlays/roof_snow_l3-v2.png` | `41c424fda13031e43e85a6b94cba496aaf414ac69b74ccb4a498308aa6f1c2ae` |
| `references/overlays/roof_snow_l4-v2.png` | `414108d8367039573613a1300f1bff97ef062357102023fa8d065c17be1106a8` |
