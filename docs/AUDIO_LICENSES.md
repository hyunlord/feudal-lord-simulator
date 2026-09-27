# 게임 소리 출처와 라이선스 (F0-V · AUDIO-1)

- **파일:** `public/audio/`에 37개(F0-V 15 + AUDIO-1 22), 모두 모노 MP3다. F0-V 15는 `scripts/buildAudio.sh`, AUDIO-1 22는 `scripts/buildAudioP1.sh`가 원본을 한 번 인코딩했다.
- **버스:** 소리 쪽 `src/audio/audioEngine.ts` `SOUND_BANK`에 파일마다 버스(화면 `ui` · 알림 `alert` · 마을 `world`)와 기본 음량이 있다.
- **라이선스 전문:** `public/licenses/audio/`에 두고, 빌드에도 싣는다.
- **받은 날:** 2026-09-26(F0-V), 2026-09-27(AUDIO-1: Kenney Impact Sounds · RPG Audio · Music Jingles를 kenney.nl에서 다시 받음).

| 소리 | 쓰는 곳 | 원본 | 출처·라이선스 |
|---|---|---|---|
| `place_ok` | 배치 확정 | Interface Sounds `confirmation_001.ogg` | Kenney Interface Sounds — CC0 1.0 — https://kenney.nl/assets/interface-sounds |
| `place_cancel` | 도구 취소(Esc·우클릭) | Interface Sounds `back_001.ogg` | 위와 같음 |
| `place_blocked` | 배치 불가 | Interface Sounds `error_006.ogg` | 위와 같음 |
| `alert_info` | 해금 배너(정보) | Interface Sounds `pluck_001.ogg` | 위와 같음 |
| `alert_warn` | 경고 줄 · 주의 | Interface Sounds `glass_004.ogg` | 위와 같음 |
| `alert_urgent` | 경고 줄 · 즉시 | Impact Sounds `impactBell_heavy_000.ogg` | Kenney Impact Sounds — CC0 1.0 — https://kenney.nl/assets/impact-sounds |
| `hammer_1` · `hammer_2` · `hammer_3` | 공사장 망치(작업 국면, 가까운 두 곳) | Impact Sounds `impactWood_medium_000/002/004.ogg` | 위와 같음 |
| `unload_wood` | 목재 부림(배달) | Impact Sounds `impactWood_heavy_001.ogg` | 위와 같음 |
| `unload_stone` | 석재 부림(배달) | Impact Sounds `impactMining_002.ogg` | 위와 같음 |
| `stage_thud` | 공사 단계 전환 | Impact Sounds `impactSoft_heavy_002.ogg` | 위와 같음 |
| `complete` | 완공 | Interface Sounds `confirmation_004.ogg` | Kenney Interface Sounds — CC0 1.0 |
| `cart_loop` | 수레 루프(화면 안 수레꾼) | RPG Audio `creak1.ogg` ×2 + Impact Sounds `impactWood_light_001.ogg` ×4를 2.4초 고리로 합성 | Kenney RPG Audio — CC0 1.0 — https://kenney.nl/assets/rpg-audio, Kenney Impact Sounds — CC0 1.0 |
| `spring_ambience` | 봄 환경(달력 봄) | 녹음 없음. `scripts/synthAmbience.py`가 바람 소음 + 새소리 사인 스윕으로 합성(seed 1300, 12초 고리) | 이 프로젝트가 만든 소리. 제3자 권리 없음 |


## AUDIO-1 (P1, 22개)

`scripts/synthAudioP1.py`가 만든 소리는 녹음이 없다: 소음을 루프 전체의 주파수 영역에서 걸러 정확히 주기적으로 만들고(이음새·페이드 없음), 종은 비화성 배음의 합, 뿔피리는 홀수 배음 위주의 합이다. 표에 Kenney 원본이 적힌 소리는 그 원본(CC0)을 섞었다. 모든 합성은 소리마다 시드가 고정이다.

| 소리 | 쓰는 곳 | 원본 | 출처·라이선스 |
|---|---|---|---|
| `summer_ambience` | 여름 환경(계절 바뀔 때 크로스페이드, 줌아웃일수록 큼) | 합성: 귀뚜라미 펄스 3무리 + 매미 대역 소음(38 Hz 떨림) + 미풍 | 이 프로젝트가 만든 소리. 제3자 권리 없음 |
| `autumn_ambience` | 가을 환경 | 합성: 돌풍 바람(저역 소음, 주기 셋) + 낙엽 바스락(고역 소음 조각) | 위와 같음 |
| `winter_ambience` | 겨울 환경 | 합성: 찬바람(중역 소음) + 휘파람 세 좁은 대역 + 낮은 울림 | 위와 같음 |
| `mill_loop` | 방앗간 날개(생산이 움직일 때) | 합성 날개 휘익 4회/5초 + RPG Audio `creak1.ogg`·`creak2.ogg`(낮춤) | 합성: 이 프로젝트 · Kenney RPG Audio — CC0 1.0 |
| `oven_loop` | 방앗간 화덕(연기 규칙 `millOvenBurning`) | 합성: 불 탁탁(짧은 고역 조각, 초당 14) + 낮은 불꽃 소리 | 이 프로젝트가 만든 소리 |
| `saw_loop` | 제재소 톱(일꾼·가동) | 합성: 밀고 당기는 톱질 6회(톱니 52·64 Hz 떨림) + 나무 울림 | 위와 같음 |
| `quarry_loop` | 채석장 망치(일꾼·가동) | Impact Sounds `impactMining_000~004.ogg` 박자 배치 | Kenney Impact Sounds — CC0 1.0 |
| `market_loop` | 시장 웅성(장날: 시장 둘레 6칸 안 장꾼) | 합성: 말소리 대역 소음 14줄의 음절 여닫기 + RPG Audio `handleCoins.ogg`·`handleCoins2.ogg` | 합성: 이 프로젝트 · Kenney RPG Audio — CC0 1.0 |
| `church_bell` | 교회 종(일요일에 교회 가는 사람이 있을 때 45초에 한 번, 장 끝) | 합성: 종 세 번(196 Hz, 배음 9) | 이 프로젝트가 만든 소리 |
| `ox_loop` | 황소(쟁기 팀·건초 수레) | Impact Sounds `footstep_wood_000·001·002·004.ogg`(낮춤) + RPG Audio `creak3.ogg`(멍에) | Kenney Impact Sounds · RPG Audio — CC0 1.0 |
| `sheep_loop` | 양 떼 방울 | 합성: 작은 방울 일곱(1.3~2.1 kHz) + 풀 스침 | 이 프로젝트가 만든 소리 |
| `fire_loop` | 화재 타오름(불타는 집) | 합성: 굵은 불꽃 소리 + 탁탁(초당 32) + 나무 터짐 | 위와 같음 |
| `rain_loop` | 비 오는 여름 빗소리(젖은 여름 날씨) | 합성: 빗줄기 대역 소음 + 빗방울 480 + 처마 물방울 | 위와 같음 |
| `famine_omen_bell` | 기근 예고 종(대기근의 소문·징후) | 합성: 낮은 종 두 번(110 Hz, 긴 울림) | 위와 같음 |
| `petition_arrival` | 청원 도착 | Impact Sounds `impactWood_heavy_000·001·002.ogg` 노크 세 번 + 합성 웅성 | Kenney Impact Sounds — CC0 1.0 · 합성: 이 프로젝트 |
| `great_famine` | 대기근 도래 | 합성: 낮은 드론(55 Hz 두 줄) + 깊은 종 두 번(82 Hz) | 이 프로젝트가 만든 소리 |
| `season_spring` | 봄이 올 때 | Music Jingles `jingles_PIZZI07.ogg` | Kenney Music Jingles — CC0 1.0 — https://kenney.nl/assets/music-jingles |
| `season_summer` | 여름이 올 때 | Music Jingles `jingles_PIZZI03.ogg` | 위와 같음 |
| `season_autumn` | 가을이 올 때 | Music Jingles `jingles_PIZZI12.ogg` | 위와 같음 |
| `season_winter` | 겨울이 올 때 | Music Jingles `jingles_PIZZI01.ogg` | 위와 같음 |
| `unlock_banner` | 해금 배너(`alert_info`는 경고 줄에 남음) | Music Jingles `jingles_PIZZI00.ogg` | 위와 같음 |
| `fanfare` | 집이 아닌 건물의 완공(짧게; 집은 `complete`) | 합성: 뿔피리 G4·C5 뒤 C장화음(1.2초) | 이 프로젝트가 만든 소리 |

- **CC0 1.0:** 저작자 표시 의무가 없다. 그래도 Kenney(www.kenney.nl) 표기를 남긴다. 라이선스 전문: `Kenney-impact-sounds-License.txt`, `Kenney-rpg-audio-License.txt`, `Kenney-interface-sounds-License.txt`, `Kenney-music-jingles-License.txt`.
- **freesound · Sonniss GDC 번들:** 쓰지 않았다(freesound 받기는 계정이 필요하고, 합성과 Kenney로 목록을 채웠다).
