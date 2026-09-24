# A⁗ natural screen-play wall fixtures

- `a4-pre-proclaim-minute-025.json.gz`: exact gzip of `output/playtest-a-quadruple-prime/replay-prep/run4/snapshots/minute-025.json`. SHA-256 of decompressed bytes: `803f8773d9ee4e4741f189fd2261dbe7012d00884e59f371afee2d5839bcc860`. Screen play run 4, 25:00 elapsed, tick 34590, before proclamation. The player did not inspect this observer file.
- `a4-full2-minute-035.json.gz`: exact gzip of `output/playtest-a-quadruple-prime/replay-full-gate-2/snapshots/minute-035.json`. SHA-256 of decompressed bytes: `44b63fac3431a932e053b678e062f3234b1e61b612c33c82b55caf474c7bfaef`. Screen play full attempt 2, 35:00 elapsed, tick 46908, after proclamation with 12 sites stalled for route. The precise 34:03 proclamation state was not captured by the five-minute observer; this is the first subsequent natural snapshot.

The gzip files preserve the original snapshot envelope and game state exactly. Test code extracts `game.state`; T2 and T3 modify copies explicitly as the work order permits.
