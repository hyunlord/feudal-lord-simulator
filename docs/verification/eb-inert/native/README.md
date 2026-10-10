# EB-INERT non-lord paired native evidence

Official run: engineB-inert-native-72c77f6. Baseline db750c16486a283e7f320ceaca70504589a00f93; product 72c77f6157ac91f21d9fde73cf262702d0f787a0. Linux aarch64, Node v24.21.0, identical package lock.

The five pairs use 24 lots and a maximum of 1,200,000 ticks. Actual early stops are retained below. All ten raw final-state files were independently hashed against their summaries and comparison.json; both sides of each pair have identical raw bytes. The official run exited 0. This is a paired non-lord final-state check, **not the standard baseline-JSON guardrail**, and does not prove full-trajectory parity or lord-mode outcome acceptance.

| Seed | Actual final tick on both sides | Stop reason | Raw final-state SHA256 on both sides |
| --- | ---: | --- | --- |
| 1 | 372667 | target-scale-stable | 9b630fec6cf85de5a58462b39625621f670b6e05eb6013f0160b49a0d0672cfb |
| 2 | 281540 | target-scale-stable | b2a14294ff70b33ba508424abb27b3bd1fbabf3d9532a005820c0b82a6e2dc2e |
| 3 | 299186 | target-scale-stable | d93f5bee752950820a534371eeedf6cafd1631b01498d80d6829b2b6382d680f |
| 4 | 281572 | target-scale-stable | 52114274ff6260212fc2769cc85d4ad523f338d76cf3fe545cc42b12f16c5c1e |
| 5 | 599642 | target-scale-stable | abebbf9529dc3f063148d1146e29b3c1767c3fdd3a013fedd0294907cbc82f27 |

The compact archive omits raw final-state files. Their paths, byte lengths and hashes are in manifest.json; originals remain in the kept official run and local fetched artifact directory. Fetch the same run with `bash scripts/remote/run.sh --fetch engineB-inert-native-72c77f6`; do not resubmit. Reproduce the verification with `node docs/verification/eb-inert/native/archive.mjs .remote-runs/engineB-inert-native-72c77f6 NEW_ARCHIVE_DIR` from the repository containing both source commits. The archived run log includes the submitted command and clean-checkout assertions.
