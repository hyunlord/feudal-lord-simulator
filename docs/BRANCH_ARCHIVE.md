# 원격 브랜치 보관 기록

본선(`codex/phase15-organic-ground`)에 모두 들어간 뒤 원격에서 지운 브랜치의 이름과 끝 커밋이다(AGENTS.md 규칙 14).
- 끝 커밋은 본선 이력 안에 있어서 사라지지 않는다.
- 되살리기: `git push origin <끝 커밋>:refs/heads/<브랜치>`. 브랜치 이름에 `main`·본선이 들어가지 않으므로 `FLS_PUSH_OK`가 필요 없다.
- 지우는 기준: 끝 커밋이 본선의 조상일 때만 지운다(`git merge-base --is-ancestor`). 본선에 없는 커밋이 하나라도 있으면 남긴다.

## 2026-09-28 정리 (본선 `9a981d6f` 기준)

| 브랜치 | 끝 커밋 | 마지막 날짜 | 마지막 커밋 제목 |
|---|---|---|---|
| `claude/b8-save` | `dd1998653207951e934ea9e98326d24e7f54c442` | 2026-09-24 | Record the trunk-merge procedure and re-verify saves on the merged tree |
| `codex/economy-turns-phase3` | `4722a76374a03082071a3250400c0cd475283ab9` | 2026-08-05 | Keep the Phase 3 economy playable under route and capacity failure |
| `codex/phase10-make-it-run` | `4d6fe5a02507c183c1db087cdef7212b24835e29` | 2026-08-08 | Make generated surfaces drive the living map |
| `codex/phase12-living-village` | `c4e3169c6f38bb72859bfde8e23f4071541db1b4` | 2026-08-09 | Keep Phase 12 handoff maintainable and evidence-current |
| `codex/phase13-full-colour` | `9eaa8bbba87429825cf56eaf044a2f0d5ef8d865` | 2026-08-09 | Bind Phase 13 delivery evidence to the published revision [skip ci] |
| `codex/phase14-scale-occlusion-performance` | `251f397eb6646b81fd1dda0597255ee474806b49` | 2026-08-10 | Bind the Phase 14 report to its public deployment |
| `codex/phase4d-wire-sprites` | `dfa6f8205f659ec9f9e343358191466174dbb2ce` | 2026-08-05 | Record authoritative DGX sprite verification |
| `codex/phase4e-land-breathe` | `7c7cd4690a47c322691f691ebb2f0d5c1cf9dbb0` | 2026-08-05 | Anchor Phase 4E evidence to the reviewed release |
| `codex/phase4f-ground-explain` | `a16e67d8232383bc76acfbace25fd590ca6a21eb` | 2026-08-05 | Make Phase 4F release claims independently inspectable |
| `codex/phase8-presentation-completion` | `7df1b2412d2ebe7a56db86237b983a4a4eb0cdc1` | 2026-08-08 | Keep the 375px court console inside the viewport |
| `codex/stage1-cause-visible` | `e7fd76362008e602e3a859d78ae0b29d3c4af538` | 2026-08-07 | Make Stage 1 delivery independently auditable |
| `codex/stage3-palisade-age` | `639651001b01850624607407234d469933ad93c6` | 2026-08-07 | Report the remediated Palisade Age evidence honestly |

남긴 브랜치(본선에 없는 커밋이 있음):

| 브랜치 | 본선에 없는 커밋 | 마지막 날짜 |
|---|---|---|
| `claude/c4-ale-chain` | 19 | 2026-09-28 |
