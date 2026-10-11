# Historical 10x continuation failures retained

Both runs use original engine 2485af4 and product c5d2b35. Both exited 1 with valid=false; source changes empty, runtime and cleanup error arrays empty. Current remote process state was not rechecked by this archive.

- a51965f: tick41000 informational season dialog exists while pause seal=false. The old guard required pause=true, so it stopped. Command45.6s, wait2965.7s.
- 8bd902b: corrected guard acknowledged only informational ledger at41000 with identical before/after presentation SHA e02395561f63484e597288a9869dc02c6dc66919c34aa989eb2480537b622c11. Stopped41151 at substantive market decision, without choosing or closing it. Command46.1s, wait4248.9s.
- Both produced receipt h-002663@40800, because h-002653/payment_flow(part:true). Direct automatic=false, canonical automatic thread=false. Manual attempted=false, verified=false. Manual work was conditional on automatic evidence, so these runs cannot adjudicate manual discoverability.

Full originals are tracked at each provenance.json files.archive path (replay captures and ordinary run metadata); JSON/log files are losslessly gzipped with original-byte hashes retained in provenance.json. Review eb-live-speed/final.png for both and 8bd eb-live-speed/information-1-before.png, information-1-after.png. Hash inventory covers every retained source artifact. Compressed manifests preserve original bytes; SHA256SUMS covers this compact archive. No product or state mutation and no new execution in this archival step.
