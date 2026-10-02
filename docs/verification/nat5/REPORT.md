# NAT-5 땅 자연스러움 — 보고서

관문: GATE_LINE

실행 위치: 둘 다.
- DGX: (마무리 때 채움)
- Mac: 단일 시험 파일, 타입 검사, ESLint(`tools/eslint`), 병합 전 검사.

## 하위 에이전트를 멈춘 훅 (사용자 요청 2026-10-03, REMOTE에 넘김)
설치 에이전트(nat5-installs)가 일을 마친 뒤 같은 "끝났음" 알림을 받고 72번 다시 깨어났다(2026-10-02 16:41:29–16:47:43 UTC). 그 사이 리드가 보낸 창고 눈 일은 받지 못해, 리드가 직접 했다(998ca7e4).
- **훅 이름**: oh-my-claudecode 4.4.5 플러그인의 `subagent-tracker`. 명령은 `node "${CLAUDE_PLUGIN_ROOT}/scripts/run.cjs" "${CLAUDE_PLUGIN_ROOT}/scripts/subagent-tracker.mjs" stop`이다. Graft 훅이 아니다(Graft는 Stop·SessionStart·UserPromptSubmit·PostToolUse에만 있고 SubagentStop에는 없다).
- **언제 걸리나**: 하위 에이전트(이름 붙은 팀원 에이전트)가 한 번 응답을 끝낼 때마다(SubagentStop). 같은 때에 세 훅이 돈다: Orca 훅(`{}` 반환), oh-my-claudecode `verify-deliverables.mjs`(`{"continue":true,"suppressOutput":true}`), 그리고 이 `subagent-tracker`.
- **남긴 메모**: `{"continue":true,"hookSpecificOutput":{"hookEventName":"SubagentStop","additionalContext":"Agent nat5-installs completed (anat5-installs-4b392772f0469cfd)"}}`. 코드는 `~/.claude/plugins/cache/omc/oh-my-claudecode/4.4.5/dist/hooks/subagent-tracker/index.js:523`의 `` `Agent ${input.agent_type} ${succeeded ? "completed" : "failed"} (${input.agent_id})` ``다.
- **왜 되풀이되나**: 이 `additionalContext`가 팀원 에이전트의 대화에 새 입력으로 들어가 에이전트가 다시 응답한다("바뀐 것 없음"). 응답이 끝나면 SubagentStop이 또 걸려 같은 메모가 또 들어간다. 에이전트 기록: `~/.claude/projects/-Users-rexxa-orca-workspaces-feudal-lord-simulator-nerite/e5637825-94ec-43b7-8814-5c0d33b9e629/subagents/agent-anat5-installs-4b392772f0469cfd.jsonl` 1965행부터.
- **영향**: 끝난 에이전트가 토큰을 쓰며 맴돌고, 그 사이 들어온 새 지시를 놓친다. 다른 NAT-5 에이전트도 끝날 때 같을 수 있다.
- **고칠 곳(판단은 REMOTE·사용자)**: 이 훅이 SubagentStop에서 `additionalContext`를 내지 않게 하거나(추적만 하고 메모 없음), 이 훅만 끄는 것(`OMC_SKIP_HOOKS`에 이 훅 이름). 렌더 세션은 설정을 바꾸지 않았다.
