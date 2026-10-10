# Audit invalidation bounded probe

This archive preserves a successful diagnostic on frozen product `9ad9253468592e7cba144946081d2fbced36adca`, plus the failed initial preflight. It does not demonstrate an outcome score improvement.

- Retry: `engineB-tlink-invalidation-retry-9ad9253`, official exit **0**, command **120.3 s**.
- Seed 3 answer `h-002840` at tick **62011**, estate-neighbour-3, charter refusal; intended/actual merchants delta −8 (−32 → −40).
- First target-specific invalidation: tick **62319 → 62320**, command ordinal **483**, during a tick (no command). Target relation evidence changes pending → invalidated before its first season at 63000.
- The result retains exact before/after oversight, steward and summary snapshots, identity comparisons, and fresh history. Oversight scalar values remain equal; this observation alone is not a general proof that every other invalidation is incorrect.
- The unchanged original command prefix was asserted during replay. Its 483-command digest independently matches the archived original contexts during packaging. The runtime asserted exact equality of **546 sampled prefix checkpoints** to original collection checkpoints; this is sampled parity, not every-tick state parity or a complete 125-year replay.

## Failed initial attempt

`engineB-tlink-invalidation-probe-9ad9253` exited **1** after **2.4 s**: strict git-status preflight rejected its own untracked injected helper. This occurred before `newGameState`, so it supplies no gameplay evidence. Both official logs are retained without alteration (gzip compressed). The initial receipt was actually available in the PROBE worktree, not the initially supplied MAIN path; manifest receiptSource records the actual source.

## Reproduction and limits

The exact initial and retry helpers are preserved under `helpers/`; SHA256SUMS covers every archive file except itself. `result.json.gz` preserves the exact result JSON bytes, including product/tool/input pins and command-prefix hash. Original contexts, collect-parity and preflight are external large inputs identified by SHA in the result. Runtime replay additionally requires the pinned source, tool files, Node/lock preflight and the official DGX execution route. Do not execute the helper on Mac; do not interpret packaging as authorization for another run.

The diagnostic ends at first invalidation, not the next seasonal result. No source fix, new future receipt, numerator increase, 80% pass, or UI acceptance is proven here. Existing scorer results remain unchanged.
